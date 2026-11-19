import { beta, gamma, rngFrom, splitByWeights, type Micro, type Rng } from "@storefront/core";

/** Aggregated observations for one arm (an ad, an ad set or a platform). */
export interface ArmStats {
  id: string;
  label: string;
  spend: number; // dollars
  impressions: number;
  clicks: number;
  results: number;
}

export interface ArmEstimate extends ArmStats {
  /** Posterior mean cost per result in dollars, null when there is not enough to say. */
  costPerResult: number | null;
  /** 80% credible interval. */
  interval: [number, number] | null;
  /** Probability this arm has the lowest cost per result. */
  pBest: number;
  /** Mean share of Thompson draws won — used directly as the allocation signal. */
  samples: number;
}

export interface Prior {
  /** Pooled conversion rate per click across sibling arms. */
  cvr: number;
  /** Pooled cost per click in dollars. */
  cpc: number;
  /** How many pseudo-clicks the prior is worth. */
  strength: number;
}

/** Empirical-Bayes prior: shrink every arm toward the pooled rate of its siblings. */
export function pooledPrior(arms: ArmStats[], fallback: { cvr: number; cpc: number }, strength = 25): Prior {
  const clicks = arms.reduce((a, x) => a + x.clicks, 0);
  const results = arms.reduce((a, x) => a + x.results, 0);
  const spend = arms.reduce((a, x) => a + x.spend, 0);
  const w = Math.min(1, clicks / 150);
  return {
    cvr: clicks > 0 ? w * ((results + 1) / (clicks + 2)) + (1 - w) * fallback.cvr : fallback.cvr,
    cpc: clicks > 0 ? w * (spend / clicks) + (1 - w) * fallback.cpc : fallback.cpc,
    strength,
  };
}

function sampleCostPerResult(rng: Rng, arm: ArmStats, prior: Prior): number {
  // Conversion rate: Beta-Binomial. Cost per click: Gamma on the click rate per dollar.
  const a = prior.cvr * prior.strength + arm.results;
  const b = (1 - prior.cvr) * prior.strength + Math.max(0, arm.clicks - arm.results);
  const cvr = Math.max(1e-6, beta(rng, a, b));
  const k0 = 4;
  const clicksPerDollar = gamma(rng, arm.clicks + k0) / (arm.spend + k0 * prior.cpc);
  return 1 / (clicksPerDollar * cvr);
}

export function estimate(arms: ArmStats[], prior: Prior, seed: string, draws = 1500): ArmEstimate[] {
  const rng = rngFrom("posterior", seed);
  const wins = arms.map(() => 0);
  const samples: number[][] = arms.map(() => []);
  for (let d = 0; d < draws; d++) {
    let best = -1;
    let bestV = Infinity;
    for (let i = 0; i < arms.length; i++) {
      const v = sampleCostPerResult(rng, arms[i], prior);
      samples[i].push(v);
      if (v < bestV) ((bestV = v), (best = i));
    }
    if (best >= 0) wins[best]++;
  }
  return arms.map((arm, i) => {
    const s = samples[i].slice().sort((x, y) => x - y);
    const enough = arm.clicks >= 5;
    return {
      ...arm,
      costPerResult: enough ? s[Math.floor(s.length / 2)] : null,
      interval: enough ? [s[Math.floor(s.length * 0.1)], s[Math.floor(s.length * 0.9)]] : null,
      pBest: wins[i] / draws,
      samples: draws,
    };
  });
}

export interface AllocationInput {
  current: Micro[];
  pBest: number[];
  total: Micro;
  /** Share spread evenly for exploration, so no arm is starved before we know enough. */
  explorationShare: number;
  /** Largest relative move per arm in one step (0.3 = ±30% of its current budget). */
  maxShift: number;
  /** Arms that may not be changed this step (e.g. edited too recently). */
  locked?: boolean[];
  /** Optional per-arm ceiling as a share of total (e.g. 0.7). */
  maxShare?: number;
  minBudget?: Micro;
}

/**
 * Thompson-style allocation with guardrails: move each arm toward
 * (1-ε)·P(best) + ε/n of the total, but never by more than maxShift per step.
 * Returned budgets are integers that sum exactly to `total`.
 */
export function allocate(inp: AllocationInput): Micro[] {
  const n = inp.current.length;
  if (n === 0) return [];
  const curTotal = inp.current.reduce((a, b) => a + b, 0) || 1;
  const scale = inp.total / curTotal;
  const base = inp.current.map((c) => c * scale); // pacing change applies to everyone equally
  const minB = inp.minBudget ?? 0;
  const lo = base.map((b, i) => (inp.locked?.[i] ? b : Math.max(minB, b * (1 - inp.maxShift))));
  const hi = base.map((b, i) => {
    if (inp.locked?.[i]) return b;
    const cap = inp.maxShare ? inp.total * inp.maxShare : Infinity;
    return Math.max(lo[i], Math.min(cap, b * (1 + inp.maxShift)));
  });
  const target = inp.pBest.map((p) => inp.total * ((1 - inp.explorationShare) * p + inp.explorationShare / n));
  const out = target.map((t, i) => Math.min(hi[i], Math.max(lo[i], t)));
  // Redistribute what the clamps took away, toward arms that still have room.
  for (let iter = 0; iter < 12; iter++) {
    const diff = inp.total - out.reduce((a, b) => a + b, 0);
    if (Math.abs(diff) < 1) break;
    const room = out.map((v, i) => (diff > 0 ? hi[i] - v : v - lo[i]));
    const weight = room.map((r, i) => (r > 0 ? r * (diff > 0 ? inp.pBest[i] + 0.05 : 1 - inp.pBest[i] + 0.05) : 0));
    const wsum = weight.reduce((a, b) => a + b, 0);
    if (wsum <= 0) break;
    for (let i = 0; i < n; i++) {
      const delta = (diff * weight[i]) / wsum;
      out[i] = Math.min(hi[i], Math.max(lo[i], out[i] + delta));
    }
  }
  return splitByWeights(inp.total, out);
}

export interface PauseRule {
  pBestBelow: number;
  minImpressions: number;
  minSpend: number;
  minActive: number;
}
export const DEFAULT_PAUSE: PauseRule = { pBestBelow: 0.04, minImpressions: 400, minSpend: 12, minActive: 2 };

/** Ads that are very unlikely to be the best in their ad set and have had a fair run. */
export function pauseCandidates(est: ArmEstimate[], rule: PauseRule = DEFAULT_PAUSE): ArmEstimate[] {
  const sorted = est.slice().sort((a, b) => a.pBest - b.pBest);
  const out: ArmEstimate[] = [];
  let remaining = est.length;
  for (const e of sorted) {
    if (remaining <= rule.minActive) break;
    if (e.pBest < rule.pBestBelow && e.impressions >= rule.minImpressions && e.spend >= rule.minSpend) {
      out.push(e);
      remaining--;
    }
  }
  return out;
}

export interface DayPoint {
  day: number;
  spend: number;
  clicks: number;
  results: number;
  budget: number;
}
export interface Anomaly {
  kind: "spend_spike" | "cpa_jump" | "tracking_broken";
  detail: string;
}

function poissonCdf(k: number, lambda: number): number {
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/**
 * Compare the last three days with the trailing ten. Small budgets are noisy, so a
 * guard only fires when the recent numbers would be very unlikely under the trailing rate.
 */
export function detectAnomalies(series: DayPoint[]): Anomaly[] {
  const out: Anomaly[] = [];
  if (series.length < 8) return out;
  const last = series[series.length - 1];
  if (last.budget > 0 && last.spend > last.budget * 1.6 && last.spend - last.budget > 3) out.push({ kind: "spend_spike", detail: `Spent $${last.spend.toFixed(2)} against a $${last.budget.toFixed(2)} daily budget` });
  const recent = series.slice(-3);
  const trail = series.slice(-13, -3);
  const tSpend = trail.reduce((a, d) => a + d.spend, 0);
  const tRes = trail.reduce((a, d) => a + d.results, 0);
  const tClicks = trail.reduce((a, d) => a + d.clicks, 0);
  const rSpend = recent.reduce((a, d) => a + d.spend, 0);
  const rRes = recent.reduce((a, d) => a + d.results, 0);
  const rClicks = recent.reduce((a, d) => a + d.clicks, 0);
  if (tRes < 6 || tClicks === 0 || tSpend === 0) return out;
  const expectedByClicks = (tRes / tClicks) * rClicks;
  if (rRes === 0 && rClicks >= 12 && Math.exp(-expectedByClicks) < 0.00005) {
    out.push({ kind: "tracking_broken", detail: `No results from ${rClicks} clicks in three days; normally about ${expectedByClicks.toFixed(1)}` });
    return out;
  }
  const expectedBySpend = (tRes / tSpend) * rSpend;
  if (rRes >= 1 && rSpend / rRes > 2 * (tSpend / tRes) && poissonCdf(rRes, expectedBySpend) < 0.0001)
    out.push({ kind: "cpa_jump", detail: `Cost per result was $${(rSpend / rRes).toFixed(2)} over three days against a usual $${(tSpend / tRes).toFixed(2)}` });
  return out;
}
