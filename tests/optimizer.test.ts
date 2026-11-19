import { describe, expect, it } from "vitest";
import { usd, type BusinessState } from "@storefront/core";
import { approvePlan, bakeryDraft, confirmProfile, fundAndLaunch, latestProfile, newBusiness, runDays, sumFacts } from "@storefront/agent";
import { oracleCostPerResult } from "@storefront/market";
import { allocate, detectAnomalies, estimate, pauseCandidates, pooledPrior } from "@storefront/optimizer";

async function run(id: string, optimise: boolean, days: number): Promise<BusinessState> {
  const s = newBusiness();
  s.id = id;
  s.draft = bakeryDraft("2026-11-23");
  s.draft.budget = { ...s.draft.budget!, totalUsd: 4500 };
  await confirmProfile(s);
  await approvePlan(s, "t");
  await fundAndLaunch(s);
  if (!optimise) s.mandate!.bounds = { ...s.mandate!.bounds, intraPlatformDailyShiftPct: 0, crossPlatformWeeklyShiftPct: 0 };
  await runDays(s, days);
  return s;
}

describe("Optimizer", () => {
  it("allocate respects max shift, floors and totals", () => {
    const next = allocate({ current: [usd(5), usd(5)], pBest: [0.95, 0.05], total: usd(10), explorationShare: 0.3, maxShift: 0.3 });
    expect(next[0] + next[1]).toBe(usd(10));
    expect(next[0]).toBeLessThanOrEqual(usd(6.5) + 1);
    expect(next[1]).toBeGreaterThanOrEqual(usd(3.5) - 1);
    const locked = allocate({ current: [usd(5), usd(5)], pBest: [0.95, 0.05], total: usd(10), explorationShare: 0.3, maxShift: 0.3, locked: [true, true] });
    expect(locked).toEqual([usd(5), usd(5)]);
  });
  it("does not crown a winner from a few lucky clicks", () => {
    const arms = [
      { id: "a", label: "a", spend: 3, impressions: 60, clicks: 3, results: 2 },
      { id: "b", label: "b", spend: 150, impressions: 4000, clicks: 150, results: 30 },
    ];
    const est = estimate(arms, pooledPrior(arms, { cvr: 0.1, cpc: 1 }), "t");
    expect(est[0].pBest).toBeLessThan(0.9);
    expect(pauseCandidates(est)).toEqual([]);
  });
  it("identifies a clearly worse arm once there is enough data", () => {
    const arms = [
      { id: "a", label: "a", spend: 200, impressions: 5000, clicks: 200, results: 50 },
      { id: "b", label: "b", spend: 200, impressions: 5000, clicks: 200, results: 8 },
      { id: "c", label: "c", spend: 200, impressions: 5000, clicks: 200, results: 45 },
    ];
    const est = estimate(arms, pooledPrior(arms, { cvr: 0.1, cpc: 1 }), "t");
    expect(est[1].pBest).toBeLessThan(0.02);
    expect(pauseCandidates(est).map((e) => e.id)).toEqual(["b"]);
  });
  it("anomaly guard stays quiet on ordinary noise", () => {
    const series = Array.from({ length: 14 }, (_, d) => ({ day: d, spend: 13 + (d % 3), clicks: 9 + (d % 4), results: d % 5 === 0 ? 0 : 2 + (d % 2), budget: 13 }));
    expect(detectAnomalies(series)).toEqual([]);
  });

  it("beats a static even split and closes part of the gap to the oracle (regret report)", async () => {
    const rows: string[] = [];
    let wins = 0;
    let optTotal = 0;
    let staticTotal = 0;
    const seeds = ["regret_a", "regret_b", "regret_c", "regret_d", "regret_e", "regret_f"];
    for (const seed of seeds) {
      const opt = await run(seed, true, 90);
      const stat = await run(seed, false, 90);
      const o = sumFacts(opt.facts);
      const st = sumFacts(stat.facts);
      const oracle = oracleCostPerResult(seed, latestProfile(opt)!.budget.goal, stat.campaigns, stat.creatives);
      const bestCpr = Math.min(...oracle.map((x) => x.best));
      const oracleResults = o.spend / 1e6 / bestCpr;
      rows.push(`${seed}: optimizer ${o.results} results, static ${st.results}, oracle≈${oracleResults.toFixed(0)}, regret ${(1 - o.results / oracleResults).toFixed(2)} vs static regret ${(1 - st.results / oracleResults).toFixed(2)}`);
      if (o.results > st.results) wins++;
      optTotal += o.results;
      staticTotal += st.results;
    }
    console.log(rows.join("\n"));
    expect(optTotal).toBeGreaterThan(staticTotal * 1.03);
    expect(wins).toBeGreaterThanOrEqual(4);
  });
});
