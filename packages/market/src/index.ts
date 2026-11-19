import {
  binomial,
  poisson,
  rngFrom,
  usd,
  type Creative,
  type Day,
  type Goal,
  type LiveAdSet,
  type LiveCampaign,
  type MetricFact,
  type Platform,
} from "@storefront/core";

/**
 * Simulated ad market. Every creative has a hidden true click and conversion rate
 * derived from its attributes, its audience and the business seed. The optimizer
 * never sees these: it only sees the noisy daily results, like the real thing.
 *
 * The simulation also models what the platforms do themselves: delivery inside an
 * ad set drifts toward the ads that get clicks, new or heavily edited ad sets go
 * through a learning phase, daily spend over- and under-delivers, and bigger
 * budgets hit diminishing returns.
 */

const BASE: Record<Platform, { ctr: number; cvr: number; cpc: number; cpm: number }> = {
  google: { ctr: 0.055, cvr: 0.15, cpc: 1.55, cpm: 0 },
  meta: { ctr: 0.012, cvr: 0.065, cpc: 0, cpm: 8.5 },
};
const GOAL_CVR: Record<Goal, number> = { foot_traffic: 1.6, calls: 1.0, bookings: 0.85, online_orders: 0.7, leads: 0.65 };
export const LEARNING_DAYS = 3;
export const OVERDELIVERY_MAX = 1.15;

function effect(seed: string, key: string, lo: number, hi: number): number {
  const r = rngFrom("truth", seed, key)();
  return lo + r * (hi - lo);
}

export interface Truth {
  ctr: number;
  cvr: number;
  /** Cost per click in dollars (derived from CPM for Meta). */
  cpc: number;
  costPerResult: number;
}

export function truth(seed: string, goal: Goal, platform: Platform, adSetKey: string, creative: Creative): Truth {
  const b = BASE[platform];
  const a = creative.attributes;
  const tilt = effect(seed, `platform:${platform}`, 0.78, 1.3);
  const ctr = b.ctr * effect(seed, `${platform}:hook:${a.hook}`, 0.72, 1.4) * effect(seed, `${platform}:visual:${a.visual}`, 0.75, 1.35) * effect(seed, `creative:${creative.id}`, 0.93, 1.07);
  const cvr = Math.min(
    0.6,
    b.cvr * GOAL_CVR[goal] * tilt * effect(seed, `${platform}:offer:${a.offer}`, 0.7, 1.45) * effect(seed, `${platform}:angle:${a.angle}`, 0.78, 1.3) * effect(seed, `audience:${adSetKey}`, 0.65, 1.45),
  );
  const cpc = platform === "google" ? b.cpc * effect(seed, `cpc:${adSetKey}`, 0.85, 1.2) : b.cpm / 1000 / ctr;
  return { ctr, cvr, cpc, costPerResult: cpc / cvr };
}

/** Audience identity survives id changes: the optimizer and the sim key on the name. */
export const adSetKey = (platform: Platform, s: { name: string }) => `${platform}:${s.name}`;

export interface SimInput {
  seed: string;
  day: number;
  weekday: Day;
  goal: Goal;
  campaigns: LiveCampaign[];
  creatives: Creative[];
  history: MetricFact[];
  /** Fault injection for tests and demos. */
  fault?: { trackingBroken?: boolean; spendSpike?: number };
}

function deliveryWeights(adSet: LiveAdSet, history: MetricFact[], platform: Platform): Map<string, number> {
  const active = adSet.ads.filter((a) => a.status === "active");
  const w = new Map<string, number>();
  const prior = BASE[platform].ctr;
  let sum = 0;
  for (const ad of active) {
    let imp = 0;
    let clk = 0;
    for (const f of history) if (f.adId === ad.id) ((imp += f.impressions), (clk += f.clicks));
    const rate = (clk + 4) / (imp + 4 / prior);
    const v = Math.pow(rate, 1.4);
    w.set(ad.id, v);
    sum += v;
  }
  const floor = 0.12 / Math.max(1, active.length);
  for (const [k, v] of w) w.set(k, Math.max(floor, v / sum));
  const s2 = [...w.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of w) w.set(k, v / s2);
  return w;
}

export function simulateDay(input: SimInput): MetricFact[] {
  const facts: MetricFact[] = [];
  const byId = new Map(input.creatives.map((c) => [c.id, c]));
  for (const camp of input.campaigns) {
    if (camp.status !== "active" || camp.pausedDays.includes(input.weekday)) continue;
    for (const adSet of camp.adSets) {
      if (adSet.status !== "active" || adSet.dailyBudget <= 0) continue;
      const rng = rngFrom("day", input.seed, input.day, adSet.id);
      const weekend = input.weekday === "sat" || input.weekday === "sun" ? 1.12 : 1;
      const pace = Math.min(OVERDELIVERY_MAX, 0.86 + rng() * 0.32) * (input.fault?.spendSpike ?? 1);
      const budgetToday = adSet.dailyBudget * pace;
      const learning = input.day - Math.max(adSet.launchedDay, adSet.lastSignificantEditDay) < LEARNING_DAYS ? 0.7 : 1;
      const saturation = 1 / (1 + adSet.dailyBudget / usd(70));
      const weights = deliveryWeights(adSet, input.history, camp.platform);
      for (const ad of adSet.ads) {
        if (ad.status !== "active") continue;
        const creative = byId.get(ad.creativeId);
        if (!creative) continue;
        const t = truth(input.seed, input.goal, camp.platform, adSetKey(camp.platform, adSet), creative);
        const share = budgetToday * (weights.get(ad.id) ?? 0);
        let impressions: number;
        let clicks: number;
        let spend: number;
        if (camp.platform === "google") {
          const cpcMicro = usd(t.cpc);
          clicks = poisson(rng, share / cpcMicro);
          spend = Math.min(Math.round(clicks * cpcMicro * (0.9 + rng() * 0.2)), Math.round(adSet.dailyBudget * OVERDELIVERY_MAX * (weights.get(ad.id) ?? 0)));
          impressions = clicks === 0 ? Math.round((share / cpcMicro / t.ctr) * (0.6 + rng() * 0.6)) : Math.round((clicks / t.ctr) * (0.85 + rng() * 0.3));
        } else {
          spend = Math.round(share);
          impressions = Math.round((spend / usd(BASE.meta.cpm)) * 1000 * (0.9 + rng() * 0.2));
          clicks = binomial(rng, impressions, t.ctr);
        }
        const cvr = input.fault?.trackingBroken ? 0 : Math.min(0.9, t.cvr * learning * saturation * weekend);
        const results = binomial(rng, clicks, cvr);
        if (spend <= 0 && impressions <= 0) continue;
        facts.push({ day: input.day, platform: camp.platform, campaignId: camp.id, adSetId: adSet.id, adId: ad.id, creativeId: creative.id, impressions, clicks, results, spend });
      }
    }
  }
  return facts;
}

/** Oracle for tests: the true cost per result of each ad set's best creative. */
export function oracleCostPerResult(seed: string, goal: Goal, campaigns: LiveCampaign[], creatives: Creative[]) {
  const byId = new Map(creatives.map((c) => [c.id, c]));
  const out: { platform: Platform; adSetId: string; best: number; byAd: { adId: string; cpr: number }[] }[] = [];
  for (const c of campaigns)
    for (const s of c.adSets) {
      const byAd = s.ads
        .map((a) => ({ adId: a.id, cpr: truth(seed, goal, c.platform, adSetKey(c.platform, s), byId.get(a.creativeId)!).costPerResult }))
        .sort((x, y) => x.cpr - y.cpr);
      out.push({ platform: c.platform, adSetId: s.id, best: byAd[0]?.cpr ?? Infinity, byAd });
    }
  return out;
}
