import { assertMicro, shortId, type BusinessState, type LedgerEntry, type LedgerLine, type Micro, type Platform } from "@storefront/core";

/** Chart of accounts for one business. Debits are positive, credits negative. */
export const ACCOUNTS = {
  wallet: "wallet",
  ownerFunds: "owner_funds",
  adSpend: (p: Platform) => `ad_spend:${p}`,
  adPayable: (p: Platform) => `ad_payable:${p}`,
  subscription: "subscription",
  agentOps: "agent_ops",
  opsPayable: "ops_payable",
  domainFee: "fees:domain",
  refunds: "refunds",
} as const;

export function post(
  state: BusinessState,
  entry: { kind: string; memo: string; lines: LedgerLine[]; txSig?: string; ref?: string; day?: number },
): LedgerEntry {
  let sum = 0;
  for (const l of entry.lines) {
    assertMicro(l.amount, `ledger line ${l.account}`);
    sum += l.amount;
  }
  if (sum !== 0) throw new Error(`Unbalanced ledger entry "${entry.kind}": lines sum to ${sum}`);
  if (entry.lines.length < 2) throw new Error("A ledger entry needs at least two lines");
  const e: LedgerEntry = {
    id: shortId("le"),
    day: entry.day ?? state.day,
    at: new Date().toISOString(),
    kind: entry.kind,
    memo: entry.memo,
    lines: entry.lines.filter((l) => l.amount !== 0),
    txSig: entry.txSig,
    ref: entry.ref,
  };
  state.ledger.push(e);
  return e;
}

export function balance(state: BusinessState, account: string): Micro {
  let b = 0;
  for (const e of state.ledger) for (const l of e.lines) if (l.account === account) b += l.amount;
  return b;
}

export function balances(state: BusinessState): Record<string, Micro> {
  const out: Record<string, Micro> = {};
  for (const e of state.ledger) for (const l of e.lines) out[l.account] = (out[l.account] ?? 0) + l.amount;
  return out;
}

export function trialBalance(state: BusinessState): Micro {
  return Object.values(balances(state)).reduce((a, b) => a + b, 0);
}
