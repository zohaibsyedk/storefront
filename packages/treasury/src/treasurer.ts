import {
  PLATFORMS,
  fmtUsd,
  shortId,
  usd,
  type AgentAction,
  type BudgetPeriod,
  type BusinessState,
  type CardTxn,
  type Mandate,
  type Micro,
  type Platform,
  type Reconciliation,
} from "@storefront/core";
import { ACCOUNTS, balance, post, trialBalance } from "./ledger";
import { CARD_SETTLEMENT, ChainError, PLATFORM_TREASURY, type Chain } from "./chain";

/**
 * Treasurer is deterministic code, not an LLM agent. Nothing here takes free text:
 * every function checks the mandate and the ledger before it signs.
 */

export function logAction(state: BusinessState, a: Omit<AgentAction, "id" | "day" | "at"> & { day?: number }): AgentAction {
  const full: AgentAction = { id: shortId("act"), day: a.day ?? state.day, at: new Date().toISOString(), ...a };
  state.actions.push(full);
  return full;
}

export function spendTotal(state: BusinessState, platform?: Platform, fromDay = 0, toDay = Infinity): Micro {
  let s = 0;
  for (const f of state.facts) if ((!platform || f.platform === platform) && f.day >= fromDay && f.day < toDay) s += f.spend;
  return s;
}
export function settledTotal(state: BusinessState): Micro {
  return state.card.txns.filter((t) => t.status === "settled").reduce((a, t) => a + t.amount, 0);
}
export function unbilledTotal(state: BusinessState): Micro {
  return PLATFORMS.reduce((a, p) => a + (state.card.unbilled[p] ?? 0), 0);
}
export function currentPeriod(m: Mandate, day: number): BudgetPeriod {
  return m.periods.find((p) => day >= p.startDay && day < p.endDay) ?? m.periods[m.periods.length - 1];
}
/** Spend allowed up to the end of the period containing `day` (caps are cumulative, so unspent money rolls forward). */
export function cumulativeCap(m: Mandate, day: number): Micro {
  const cur = currentPeriod(m, day);
  return m.periods.filter((p) => p.index <= cur.index).reduce((a, p) => a + p.adCap, 0);
}
export function periodHeadroom(state: BusinessState, day = state.day): Micro {
  const m = state.mandate;
  if (!m) return 0;
  return Math.max(0, Math.min(cumulativeCap(m, day), m.totalAdBudget) - spendTotal(state));
}

/** Money set aside in the wallet that the card must never be able to reach. */
export function reservedNonAd(state: BusinessState): Micro {
  const bal = balance(state, ACCOUNTS.wallet);
  const m = state.mandate;
  if (!m) return bal;
  const adLeft = Math.max(0, m.totalAdBudget - settledTotal(state));
  return Math.max(0, bal - adLeft);
}

/** The on-chain spending limit the card should have right now. */
export function targetAllowance(state: BusinessState): Micro {
  const m = state.mandate;
  if (!m || m.status !== "active" || state.card.frozen) return 0;
  const toSettle = Math.max(0, m.totalAdBudget - settledTotal(state));
  const want = unbilledTotal(state) + periodHeadroom(state) + m.allowanceBuffer;
  return Math.max(0, Math.min(toSettle, want, balance(state, ACCOUNTS.wallet)));
}

export async function fundWallet(state: BusinessState, chain: Chain, amount: Micro, memo: string) {
  if (!state.wallet) throw new Error("No wallet");
  const tx = await chain.onramp(state.wallet.address, amount, memo);
  post(state, {
    kind: "deposit",
    memo,
    txSig: tx.sig,
    lines: [
      { account: ACCOUNTS.wallet, amount },
      { account: ACCOUNTS.ownerFunds, amount: -amount },
    ],
  });
  logAction(state, { actor: "Treasurer", kind: "deposit", title: `Received ${fmtUsd(amount)} and converted it to USDC`, reason: memo, amount, txSig: tx.sig });
  return tx;
}

export async function payFromWallet(state: BusinessState, chain: Chain, account: string, amount: Micro, title: string, reason: string) {
  if (!state.wallet) throw new Error("No wallet");
  if (amount <= 0) return null;
  const tx = await chain.transfer(state.wallet.keyRef, state.wallet.address, PLATFORM_TREASURY, amount, title);
  post(state, {
    kind: "fee",
    memo: title,
    txSig: tx.sig,
    lines: [
      { account, amount },
      { account: ACCOUNTS.wallet, amount: -amount },
    ],
  });
  logAction(state, { actor: "Treasurer", kind: "fee", title, reason, amount, txSig: tx.sig });
  return tx;
}

/** Agent running costs (model usage) accrue as they happen and are settled in one transfer. */
export function accrueOps(state: BusinessState, amount: Micro, what: string): boolean {
  const m = state.mandate;
  const cap = m?.opsReserve ?? state.plans[state.plans.length - 1]?.budget.opsReserve ?? 0;
  const used = balance(state, ACCOUNTS.agentOps);
  if (used + amount > cap) return false;
  post(state, {
    kind: "ops_accrual",
    memo: what,
    lines: [
      { account: ACCOUNTS.agentOps, amount },
      { account: ACCOUNTS.opsPayable, amount: -amount },
    ],
  });
  return true;
}
export async function settleOps(state: BusinessState, chain: Chain) {
  if (!state.wallet) return null;
  const due = -balance(state, ACCOUNTS.opsPayable);
  if (due <= 0) return null;
  const tx = await chain.transfer(state.wallet.keyRef, state.wallet.address, PLATFORM_TREASURY, due, "Agent running costs");
  post(state, {
    kind: "ops_settlement",
    memo: "Agent running costs",
    txSig: tx.sig,
    lines: [
      { account: ACCOUNTS.opsPayable, amount: due },
      { account: ACCOUNTS.wallet, amount: -due },
    ],
  });
  logAction(state, { actor: "Treasurer", kind: "ops", title: `Paid ${fmtUsd(due)} in agent running costs`, reason: "Model usage for planning, daily optimisation and reports, drawn from the 20% reserve.", amount: due, txSig: tx.sig });
  return tx;
}

export async function syncAllowance(state: BusinessState, chain: Chain, why: string) {
  if (!state.wallet) return null;
  const target = targetAllowance(state);
  const cur = await chain.allowance(state.wallet.address);
  if (cur.delegate === state.wallet.delegate && cur.amount === target) return null;
  if (target === 0) {
    if (!cur.delegate) return null;
    const tx = await chain.revoke(state.wallet.keyRef, state.wallet.address);
    logAction(state, { actor: "Treasurer", kind: "allowance", title: "Removed the card's spending limit", reason: why, amount: 0, txSig: tx.sig });
    return tx;
  }
  // Only re-approve when the change is material, to avoid a transaction per day.
  const drift = Math.abs(cur.amount - target);
  if (cur.delegate === state.wallet.delegate && cur.amount > 0 && cur.amount <= maxAllowance(state) && drift < usd(1) && cur.amount >= unbilledTotal(state)) return null;
  const tx = await chain.approve(state.wallet.keyRef, state.wallet.address, state.wallet.delegate, target);
  logAction(state, { actor: "Treasurer", kind: "allowance", title: `Set the card's spending limit to ${fmtUsd(target)}`, reason: why, amount: target, txSig: tx.sig });
  return tx;
}

/** Hard ceiling from the mandate. Invariant: on-chain allowance never exceeds this. */
export function maxAllowance(state: BusinessState): Micro {
  const m = state.mandate;
  if (!m || m.status !== "active") return unbilledTotal(state);
  return Math.min(Math.max(0, m.totalAdBudget - settledTotal(state)), unbilledTotal(state) + periodHeadroom(state) + m.allowanceBuffer);
}

export function accrueAdSpend(state: BusinessState, platform: Platform, amount: Micro, day: number) {
  if (amount <= 0) return;
  post(state, {
    kind: "ad_spend",
    day,
    memo: `Ad delivery on ${platform}, day ${day + 1}`,
    lines: [
      { account: ACCOUNTS.adSpend(platform), amount },
      { account: ACCOUNTS.adPayable(platform), amount: -amount },
    ],
  });
  state.card.unbilled[platform] = (state.card.unbilled[platform] ?? 0) + amount;
}

/**
 * Ad platforms bill in arrears: when unbilled spend crosses a threshold, and at month end.
 * The card rail then pulls USDC from the wallet using its delegated allowance.
 */
export async function billDue(state: BusinessState, chain: Chain, day: number, opts: { force?: boolean } = {}): Promise<CardTxn[]> {
  const out: CardTxn[] = [];
  if (!state.wallet) return out;
  const monthEnd = (day + 1) % 30 === 0;
  for (const platform of PLATFORMS) {
    const due = state.card.unbilled[platform] ?? 0;
    if (due <= 0) continue;
    if (!opts.force && !monthEnd && due < state.card.threshold[platform]) continue;
    const txn: CardTxn = { id: shortId("card"), day, platform, amount: due, status: "settled", reason: opts.force ? "Final bill" : monthEnd ? "Monthly bill" : "Billing threshold reached" };
    try {
      if (state.card.frozen) throw new ChainError("not_delegate", "Card is frozen");
      const tx = await chain.delegatedTransfer(state.wallet.delegateRef, state.wallet.delegate, state.wallet.address, CARD_SETTLEMENT, due, `${platform} ads bill`);
      txn.txSig = tx.sig;
      state.card.unbilled[platform] = 0;
      post(state, {
        kind: "card_settlement",
        day,
        memo: `${platform} ads bill paid by card`,
        txSig: tx.sig,
        ref: txn.id,
        lines: [
          { account: ACCOUNTS.adPayable(platform), amount: due },
          { account: ACCOUNTS.wallet, amount: -due },
        ],
      });
      // Platforms raise the threshold after each successful payment.
      state.card.threshold[platform] = Math.min(usd(250), Math.round(state.card.threshold[platform] * 1.5));
      logAction(state, { day, actor: "Treasurer", kind: "card", title: `Card paid ${fmtUsd(due)} to ${platform === "google" ? "Google Ads" : "Meta"}`, reason: `${txn.reason}. Paid in USDC from the agent wallet within the spending limit.`, amount: due, txSig: tx.sig });
    } catch (err) {
      txn.status = "declined";
      txn.reason = err instanceof Error ? err.message : "Declined";
      logAction(state, { day, actor: "Treasurer", kind: "card_declined", severity: "alert", title: `Card declined a ${fmtUsd(due)} ${platform} charge`, reason: txn.reason, amount: due });
    }
    state.card.txns.push(txn);
    out.push(txn);
  }
  return out;
}

export async function reconcile(state: BusinessState, chain: Chain, day: number): Promise<Reconciliation> {
  const checks: Reconciliation["checks"] = [];
  const tol = usd(1);
  const add = (label: string, a: Micro, b: Micro, detail: string) => checks.push({ label, a, b, ok: Math.abs(a - b) <= tol, detail });

  const onChain = state.wallet ? await chain.balance(state.wallet.address) : 0;
  add("Wallet balance", balance(state, ACCOUNTS.wallet), onChain, "Ledger vs on-chain USDC");

  const platformSpend = spendTotal(state);
  const ledgerSpend = PLATFORMS.reduce((a, p) => a + balance(state, ACCOUNTS.adSpend(p)), 0);
  add("Ad spend", ledgerSpend, platformSpend, "Ledger vs what the ad platforms report");

  const cardSettled = settledTotal(state);
  const chainPulled = state.chain.txs.filter((t) => t.kind === "delegated_transfer").reduce((a, t) => a + t.amount, 0);
  add("Card charges", cardSettled, chainPulled, "Card statement vs USDC pulled on-chain");

  const payable = -PLATFORMS.reduce((a, p) => a + balance(state, ACCOUNTS.adPayable(p)), 0);
  add("Not yet billed", payable, unbilledTotal(state), "Ledger payable vs platform unbilled balance");
  add("Spend = paid + unbilled", platformSpend, cardSettled + unbilledTotal(state), "Every dollar of delivery is either paid or awaiting a bill");
  add("Books balance", trialBalance(state), 0, "Debits equal credits");

  const rec: Reconciliation = { day, at: new Date().toISOString(), ok: checks.every((c) => c.ok), checks };
  state.reconciliations.push(rec);
  if (!rec.ok) {
    const bad = checks.filter((c) => !c.ok).map((c) => c.label).join(", ");
    logAction(state, { day, actor: "Treasurer", kind: "reconciliation", severity: "alert", title: "Money check found a mismatch", reason: `These did not match within $1: ${bad}.` });
  }
  return rec;
}

/** Violations of the money invariants. Empty = safe. Checked before every budget change and in property tests. */
export async function invariantViolations(state: BusinessState, chain: Chain): Promise<string[]> {
  const v: string[] = [];
  const m = state.mandate;
  if (!m) return v;
  const spent = spendTotal(state);
  if (spent > m.totalAdBudget) v.push(`Total ad spend ${fmtUsd(spent)} exceeds the approved ${fmtUsd(m.totalAdBudget)}`);
  for (const p of m.periods) {
    const upTo = spendTotal(state, undefined, 0, p.endDay);
    const cap = m.periods.filter((q) => q.index <= p.index).reduce((a, q) => a + q.adCap, 0);
    if (upTo > cap + m.allowanceBuffer) v.push(`Spend through period ${p.index + 1} is ${fmtUsd(upTo)}, over the cap ${fmtUsd(cap)}`);
  }
  if (state.wallet) {
    const al = await chain.allowance(state.wallet.address);
    if (al.amount > maxAllowance(state) + usd(1)) v.push(`Card spending limit ${fmtUsd(al.amount)} is above the mandate limit ${fmtUsd(maxAllowance(state))}`);
  }
  for (const c of state.campaigns) if (c.status === "active" && !m.allowedPlatforms.includes(c.platform)) v.push(`Campaign on unapproved platform ${c.platform}`);
  const daily = dailyBudgetTotal(state);
  const remaining = m.totalAdBudget - spent;
  if (m.status === "active" && daily > 0 && Math.round(daily * m.overdelivery) > remaining + usd(0.01)) v.push(`Daily budgets ${fmtUsd(daily)} could overshoot the remaining ${fmtUsd(remaining)}`);
  if (settledTotal(state) > m.totalAdBudget) v.push("Card charges exceed the approved ad budget");
  return v;
}

export function dailyBudgetTotal(state: BusinessState, platform?: Platform): Micro {
  let s = 0;
  for (const c of state.campaigns) {
    if (c.status !== "active" || (platform && c.platform !== platform)) continue;
    for (const a of c.adSets) if (a.status === "active") s += a.dailyBudget;
  }
  return s;
}

/**
 * Kill switch. Order matters: platforms bill in arrears, so revoking the allowance
 * first would bounce the bill for ads that already ran and get the ad account suspended.
 * 1) pause everything  2) shrink the limit to exactly what is owed  3) pay the final bill
 * 4) revoke the limit  5) freeze the card.
 */
export async function killSwitch(state: BusinessState, chain: Chain, by: string): Promise<string[]> {
  const steps: string[] = [];
  for (const c of state.campaigns) {
    if (c.status === "active") c.status = "paused";
    for (const a of c.adSets) a.status = "paused";
  }
  steps.push("Paused every campaign on every platform");
  if (state.mandate) state.mandate.status = "stopped";
  if (state.wallet) {
    const owed = unbilledTotal(state);
    if (owed > 0) {
      await chain.approve(state.wallet.keyRef, state.wallet.address, state.wallet.delegate, Math.min(owed, await chain.balance(state.wallet.address)));
      steps.push(`Shrank the card's spending limit to the ${fmtUsd(owed)} already owed for ads that ran`);
      const bills = await billDue(state, chain, state.day, { force: true });
      const paid = bills.filter((b) => b.status === "settled").reduce((a, b) => a + b.amount, 0);
      steps.push(`Paid the final ${fmtUsd(paid)} bill so no ad account is left in debt`);
    }
    const al = await chain.allowance(state.wallet.address);
    if (al.delegate) {
      const tx = await chain.revoke(state.wallet.keyRef, state.wallet.address);
      steps.push(`Revoked the card's spending limit on-chain (${tx.sig.slice(0, 10)}…)`);
    } else steps.push("Card had no spending limit left to revoke");
    await settleOps(state, chain);
  }
  state.card.frozen = true;
  steps.push("Froze the card");
  state.status = "stopped";
  state.killed = { at: new Date().toISOString(), day: state.day, steps };
  logAction(state, { actor: by === "owner" ? "Owner" : "Treasurer", kind: "kill_switch", severity: "alert", title: "Everything stopped", reason: steps.join(". ") + ". Unspent money stays in the wallet and can be withdrawn." });
  await reconcile(state, chain, state.day);
  return steps;
}

/** Return unspent USDC to the owner (off-ramp is mocked: funds leave the wallet). */
export async function withdrawUnspent(state: BusinessState, chain: Chain): Promise<Micro> {
  if (!state.wallet) return 0;
  if (state.mandate?.status === "active") throw new Error("Stop the campaigns before withdrawing");
  const amount = await chain.balance(state.wallet.address);
  if (amount <= 0) return 0;
  const tx = await chain.transfer(state.wallet.keyRef, state.wallet.address, fakeOwnerBank, amount, "Refund of unspent funds");
  post(state, {
    kind: "refund",
    memo: "Unspent funds returned to owner",
    txSig: tx.sig,
    lines: [
      { account: ACCOUNTS.refunds, amount },
      { account: ACCOUNTS.wallet, amount: -amount },
    ],
  });
  logAction(state, { actor: "Treasurer", kind: "refund", title: `Returned ${fmtUsd(amount)} of unspent money`, reason: "Campaigns are stopped, so everything left in the wallet goes back to you.", amount, txSig: tx.sig });
  return amount;
}
const fakeOwnerBank = "OwnerPayoutAccount1111111111111111111111111";
