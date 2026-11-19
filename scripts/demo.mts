/**
 * Headless run of the MVP definition of done:
 * onboard a bakery -> draft -> request a change -> approve -> fund & launch
 * -> 30 simulated days -> reconcile -> kill switch.
 *   npm run demo            (optionally: DAYS=90 npm run demo)
 */
import os from "node:os";
import path from "node:path";
import { PLATFORMS, fmtUsd } from "@storefront/core";
import { approvePlan, bakeryDraft, chainFor, confirmProfile, fundAndLaunch, latestPlan, newBusiness, requestChange, runDays, sumFacts } from "@storefront/agent";
import { ACCOUNTS, balance, invariantViolations, killSwitch } from "@storefront/treasury";

process.env.STOREFRONT_DATA_DIR ??= path.join(os.tmpdir(), "storefront-demo");
const days = Number(process.env.DAYS ?? 30);

const state = newBusiness();
if (process.env.SEED) state.id = process.env.SEED;
state.draft = bakeryDraft("2026-11-23");
const line = (s = "") => console.log(s);

const plan1 = await confirmProfile(state);
line(`Plan v${plan1.version}: ${plan1.strategy.summary}`);
line(`  budget ${fmtUsd(plan1.budget.total)} = ads ${fmtUsd(plan1.budget.adSpend)} + reserve ${fmtUsd(plan1.budget.opsReserve)}; due at approval ${fmtUsd(plan1.budget.dueAtApproval)}`);
line(`  domains: ${plan1.site?.domainSuggestions.map((d) => `${d.domain} ${fmtUsd(d.price)}`).join(", ")}`);
for (const c of plan1.creatives) line(`  [${c.id}] ${c.headline} | ${c.body}`);

const cr = await requestChange(state, "site", "Less formal tone, focus on celebration cakes, and use the second domain");
line(`\nChange request -> ${cr.outcome}`);
for (const d of cr.diff ?? []) line(`  ${d.area} / ${d.label}: "${d.before}" -> "${d.after}"`);

await approvePlan(state, "owner@example.com");
await fundAndLaunch(state);
line(`\nExecution:`);
for (const s of state.execution) line(`  [${s.status}] ${s.label}: ${s.detail}`);

await runDays(state, days);
const chain = chainFor(state);
const all = sumFacts(state.facts);
line(`\nAfter ${state.day} days: spend ${fmtUsd(all.spend)}, results ${all.results}, cost per result ${all.results ? fmtUsd(Math.round(all.spend / all.results)) : "n/a"}`);
for (const p of PLATFORMS) {
  const s = sumFacts(state.facts, (f) => f.platform === p);
  const daily = state.campaigns.find((c) => c.platform === p)!.adSets.map((a) => `${a.name}=${fmtUsd(a.dailyBudget)}`).join(", ");
  line(`  ${p}: spend ${fmtUsd(s.spend)}, results ${s.results}, cpr ${s.results ? fmtUsd(Math.round(s.spend / s.results)) : "n/a"} | daily: ${daily}`);
}
line(`\nAgent actions:`);
for (const a of state.actions.filter((x) => ["Optimizer", "CreativeProducer"].includes(x.actor))) line(`  day ${a.day + 1} ${a.title}\n      ${a.reason}`);
line(`\nDashboard (${state.dashboard?.stage}): ${state.dashboard?.widgets.map((w) => w.type + (w.core ? "*" : "")).join(", ")}`);
for (const i of state.dashboard?.insights ?? []) line(`  insight: ${i.text}`);
const rec = state.reconciliations[state.reconciliations.length - 1];
line(`\nReconciliation day ${rec.day + 1}: ${rec.ok ? "OK" : "MISMATCH"}`);
for (const c of rec.checks) line(`  ${c.ok ? "ok " : "BAD"} ${c.label}: ${fmtUsd(c.a)} vs ${fmtUsd(c.b)}`);
line(`Bad reconciliations: ${state.reconciliations.filter((r) => !r.ok).length} of ${state.reconciliations.length}`);
line(`Invariant violations: ${JSON.stringify(await invariantViolations(state, chain))}`);
line(`Allowance: ${fmtUsd((await chain.allowance(state.wallet!.address)).amount)}; wallet ${fmtUsd(await chain.balance(state.wallet!.address))}; ops used ${fmtUsd(balance(state, ACCOUNTS.agentOps))}`);
line(`Card: ${state.card.txns.map((t) => `${t.platform} ${fmtUsd(t.amount)} ${t.status}`).join("; ")}`);
line(`Alerts: ${state.actions.filter((a) => a.severity === "alert").map((a) => a.title).join("; ") || "none"}`);

if (state.status === "live") {
  const steps = await killSwitch(state, chain, "owner");
  line(`\nKill switch:`);
  for (const s of steps) line(`  - ${s}`);
  line(`Allowance after: ${fmtUsd((await chain.allowance(state.wallet!.address)).amount)}; wallet ${fmtUsd(await chain.balance(state.wallet!.address))}; status ${state.status}`);
  line(`Final reconciliation: ${state.reconciliations[state.reconciliations.length - 1].ok ? "OK" : "MISMATCH"}`);
}
void latestPlan;
