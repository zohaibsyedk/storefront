import { OFFERS, shortId, usd, type BusinessState, type Creative, type LaunchPlan, type Mandate, type Micro, type Platform } from "@storefront/core";
import { OVERDELIVERY_MAX } from "@storefront/market";

/** Approving a plan creates the mandate: the bounded authority the agent acts under. */
export function createMandate(plan: LaunchPlan, approvedBy: string): Mandate {
  return {
    id: shortId("mandate"),
    planVersion: plan.version,
    planHash: plan.hash,
    approvedAt: new Date().toISOString(),
    approvedBy,
    totalAdBudget: plan.budget.adSpend,
    opsReserve: plan.budget.opsReserve,
    days: plan.budget.days,
    periods: plan.budget.periods,
    allowedPlatforms: plan.campaigns.map((c) => c.platform),
    bounds: plan.autonomy,
    allowanceBuffer: Math.min(usd(25), Math.floor(plan.budget.periods[0].adCap * 0.05)),
    overdelivery: Math.max(1.2, OVERDELIVERY_MAX),
    approvedOffers: [...OFFERS],
    status: "active",
  };
}

export type Verdict = { ok: true } | { ok: false; reason: string };
const no = (reason: string): Verdict => ({ ok: false, reason });

export function checkIntraShift(m: Mandate, before: Micro, after: Micro, pacingScale: number): Verdict {
  const base = before * pacingScale;
  if (base <= 0) return { ok: true };
  const pct = (Math.abs(after - base) / base) * 100;
  return pct <= m.bounds.intraPlatformDailyShiftPct + 0.5 ? { ok: true } : no(`A ${pct.toFixed(0)}% move is more than the ${m.bounds.intraPlatformDailyShiftPct}% a day you allowed`);
}

export function checkPlatformShares(m: Mandate, before: Record<Platform, Micro>, after: Record<Platform, Micro>): Verdict {
  const tb = Object.values(before).reduce((a, b) => a + b, 0) || 1;
  const ta = Object.values(after).reduce((a, b) => a + b, 0) || 1;
  for (const p of Object.keys(after) as Platform[]) {
    if (!m.allowedPlatforms.includes(p) && after[p] > 0) return no(`${p} is not an approved platform`);
    const sa = after[p] / ta;
    const sb = (before[p] ?? 0) / tb;
    if (sa * 100 > m.bounds.maxPlatformSharePct + 0.5) return no(`That would put ${(sa * 100).toFixed(0)}% on one platform; your limit is ${m.bounds.maxPlatformSharePct}%`);
    if (sb > 0 && (Math.abs(sa - sb) / sb) * 100 > m.bounds.crossPlatformWeeklyShiftPct + 0.5) return no(`That moves more than ${m.bounds.crossPlatformWeeklyShiftPct}% between platforms in one week`);
  }
  return { ok: true };
}

export function checkNewCreative(m: Mandate, c: Creative): Verdict {
  if (!m.allowedPlatforms.includes(c.platform)) return no("Platform not approved");
  if (!m.approvedOffers.includes(c.attributes.offer)) return no("Uses an offer you have not approved");
  if (!c.policy.ok) return no(c.policy.notes.join("; "));
  return { ok: true };
}

export function mandateActive(state: BusinessState): boolean {
  return !!state.mandate && state.mandate.status === "active" && state.status === "live";
}
