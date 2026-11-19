import {
  ANGLES,
  ATTRIBUTE_LABEL,
  GOAL_LABEL,
  HOOKS,
  OFFERS,
  PLATFORMS,
  PLATFORM_LABEL,
  VISUALS,
  fmtUsd,
  shortId,
  splitByWeights,
  toUsd,
  weekdayForDay,
  type BusinessState,
  type Creative,
  type CreativeAttributes,
  type LiveAdSet,
  type LiveCampaign,
  type MetricFact,
  type Micro,
  type Platform,
} from "@storefront/core";
import { LEARNING_DAYS, simulateDay, type SimInput } from "@storefront/market";
import { allocate, detectAnomalies, estimate, pauseCandidates, pooledPrior, type ArmEstimate, type ArmStats, type DayPoint } from "@storefront/optimizer";
import { ACCOUNTS, accrueAdSpend, accrueOps, billDue, currentPeriod, dailyBudgetTotal, invariantViolations, logAction, payFromWallet, periodHeadroom, reconcile, settleOps, spendTotal, syncAllowance } from "@storefront/treasury";
import { policyCheck, writeCreative } from "./copy";
import { curateDashboard, weeklyReport } from "./dashboard";
import { pickPhoto } from "./draft";
import { OPS_COST, chainFor, latestPlan, latestProfile } from "./lifecycle";
import { checkIntraShift, checkNewCreative, checkPlatformShares, mandateActive } from "./mandate";

const PLATFORM_PRIOR: Record<Platform, { cvr: number; cpc: number }> = { google: { cvr: 0.15, cpc: 1.5 }, meta: { cvr: 0.07, cpc: 0.75 } };
const MIN_CLICKS_TO_ACT = 30;
const MAX_ADS_PER_SET = 5;
/**
 * Platforms re-enter a learning phase after a big edit, which costs more than the edit gains.
 * So budget steps stay under the ~20% "significant edit" line and happen every few days,
 * and an ad set's ads are changed at most once a fortnight.
 */
const GENTLE_STEP = 0.18;
const BUDGET_STEP_EVERY = 3;
const AD_EDIT_GAP_DAYS = 14;

export function sumFacts(facts: MetricFact[], pred: (f: MetricFact) => boolean = () => true) {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let results = 0;
  for (const f of facts) if (pred(f)) ((spend += f.spend), (impressions += f.impressions), (clicks += f.clicks), (results += f.results));
  return { spend, impressions, clicks, results };
}
function arm(id: string, label: string, facts: MetricFact[], pred: (f: MetricFact) => boolean): ArmStats {
  const s = sumFacts(facts, pred);
  return { id, label, spend: toUsd(s.spend), impressions: s.impressions, clicks: s.clicks, results: s.results };
}
const activeSets = (c: LiveCampaign) => c.adSets.filter((a) => a.status === "active");
const platformDaily = (state: BusinessState, p: Platform) => dailyBudgetTotal(state, p);

function activeDaysBetween(state: BusinessState, from: number, to: number): number {
  const start = latestProfile(state)!.budget.startDate;
  const paused = new Set(state.campaigns.flatMap((c) => c.pausedDays));
  if (paused.size === 0) return Math.max(1, to - from);
  let n = 0;
  for (let d = from; d < to; d++) if (!paused.has(weekdayForDay(start, d))) n++;
  return Math.max(1, n);
}

/**
 * Pacing: set the total daily budget so the remaining money lasts exactly the remaining
 * days, and so that even worst-case overdelivery today cannot break a cap.
 */
export function paceBudgets(state: BusinessState, day: number): void {
  const m = state.mandate;
  if (!m) return;
  const remaining = Math.max(0, m.totalAdBudget - spendTotal(state));
  const period = currentPeriod(m, day);
  const headroom = periodHeadroom(state, day);
  let daily = Math.min(remaining / activeDaysBetween(state, day, m.days), headroom / activeDaysBetween(state, day, period.endDay));
  daily = Math.floor(Math.max(0, Math.min(daily, remaining / m.overdelivery, headroom / m.overdelivery)));
  const sets = state.campaigns.filter((c) => c.status === "active").flatMap(activeSets);
  if (sets.length === 0) return;
  const current = sets.reduce((a, s) => a + s.dailyBudget, 0);
  const guardPaused = state.campaigns.some((c) => c.status === "paused");
  if (guardPaused) daily = Math.min(daily, current); // never push a paused platform's money onto the other one
  const next = splitByWeights(daily, sets.map((s) => Math.max(1, s.dailyBudget)));
  sets.forEach((s, i) => (s.dailyBudget = next[i]));
}

function nextAttribute(set: LiveAdSet, creatives: Creative[], winner: Creative, generation: number): CreativeAttributes | null {
  const dims: [keyof CreativeAttributes, readonly string[]][] = [
    ["hook", HOOKS],
    ["offer", OFFERS],
    ["angle", ANGLES],
    ["visual", VISUALS],
  ];
  const inSet = set.ads.map((a) => creatives.find((c) => c.id === a.creativeId)).filter((c): c is Creative => !!c);
  for (let k = 0; k < dims.length; k++) {
    const [dim, values] = dims[(generation + k) % dims.length];
    if (dim === "visual" && winner.platform === "google") continue;
    const tried = new Set(inSet.map((c) => c.attributes[dim] as string));
    const fresh = values.find((v) => !tried.has(v) && !(dim === "visual" && v === "type_only"));
    if (fresh) return { ...winner.attributes, [dim]: fresh } as CreativeAttributes;
  }
  return null;
}

async function optimise(state: BusinessState, day: number): Promise<void> {
  const m = state.mandate!;
  const plan = latestPlan(state)!;
  const profile = latestProfile(state)!;
  const goal = GOAL_LABEL[profile.budget.goal];
  const facts = state.facts;
  const recent = facts.filter((f) => f.day > day - 28);

  // --- Guards first: anomalies pause a platform before any budget moves. ---
  for (const camp of state.campaigns) {
    if (camp.status !== "active") continue;
    const series: DayPoint[] = [];
    for (let d = Math.max(0, day - 13); d <= day; d++) {
      const s = sumFacts(facts, (f) => f.day === d && f.platform === camp.platform);
      const wd = weekdayForDay(profile.budget.startDate, d);
      if (camp.pausedDays.includes(wd)) continue;
      series.push({ day: d, spend: toUsd(s.spend), clicks: s.clicks, results: s.results, budget: toUsd(platformDaily(state, camp.platform)) });
    }
    // A cost jump right after our own edit is the platform re-learning, not an anomaly.
    const justEdited = camp.adSets.some((a) => day - a.lastSignificantEditDay < LEARNING_DAYS + 2);
    const anomalies = detectAnomalies(series).filter((a) => !(a.kind === "cpa_jump" && justEdited));
    if (anomalies.length) {
      camp.status = "paused";
      const a = anomalies[0];
      const what = a.kind === "tracking_broken" ? "results stopped being recorded" : a.kind === "spend_spike" ? "spending jumped" : `cost per ${goal.result} more than doubled`;
      logAction(state, { day, actor: "Optimizer", kind: "guard_pause", severity: "alert", title: `Paused ${PLATFORM_LABEL[camp.platform]} because ${what}`, reason: `${a.detail}. Ads on this platform stay paused, and its budget stays unspent, until you say resume in “Ask your marketer”.` });
    }
  }

  for (const camp of state.campaigns) {
    if (camp.status !== "active") continue;
    const sets = activeSets(camp);
    const pClicks = sumFacts(recent, (f) => f.platform === camp.platform).clicks;

    // --- Ads inside each ad set: pause clear losers, then test one new idea. ---
    for (const set of sets) {
      const active = set.ads.filter((a) => a.status === "active");
      if (active.length < 2) continue;
      const arms = active.map((a) => {
        const c = state.creatives.find((x) => x.id === a.creativeId)!;
        return arm(a.id, c.headline, recent, (f) => f.adId === a.id);
      });
      const est = estimate(arms, pooledPrior(arms, PLATFORM_PRIOR[camp.platform]), `${state.id}:${day}:${set.id}`);
      const settled = day - set.lastSignificantEditDay >= AD_EDIT_GAP_DAYS;
      const losers = settled ? pauseCandidates(est).slice(0, 1) : [];
      for (const loser of losers) {
        const ad = set.ads.find((a) => a.id === loser.id)!;
        const best = est.slice().sort((a, b) => b.pBest - a.pBest)[0];
        ad.status = "paused";
        ad.pausedReason = `Only a ${(loser.pBest * 100).toFixed(0)}% chance of being the best ad in this audience`;
        set.lastSignificantEditDay = day + 1;
        logAction(state, {
          day,
          actor: "Optimizer",
          kind: "ad_paused",
          title: `Paused the ad “${loser.label}”`,
          reason: `After ${loser.impressions.toLocaleString("en-US")} views and ${fmtUsd(Math.round(loser.spend * 1e6))} it has brought ${loser.results} ${loser.results === 1 ? goal.result : goal.results}. There is only a ${(loser.pBest * 100).toFixed(0)}% chance it is the best ad for “${set.name}”; “${best.label}” is at ${(best.pBest * 100).toFixed(0)}%.`,
        });
        state.decisions.push({
          id: shortId("dec"),
          day,
          scope: `adset:${set.id}`,
          inputs: { audience: set.name, platform: camp.platform, windowDays: 28 },
          estimates: est.map((e) => ({ label: e.label, costPerResult: e.costPerResult, pBest: e.pBest, spend: e.spend, results: e.results })),
          alternatives: ["Keep all ads running and wait for more data", "Pause two ads at once (rejected: resets the platform's learning)"],
          action: `Paused “${loser.label}”`,
          expected: `More of this audience's budget reaches the stronger ads, lowering cost per ${goal.result}.`,
        });

        // CreativeProducer: exploit the winner's attributes, explore exactly one new attribute.
        const winnerAd = set.ads.find((a) => a.id === best.id);
        const winner = winnerAd && state.creatives.find((c) => c.id === winnerAd.creativeId);
        if (winner && set.ads.length < MAX_ADS_PER_SET) {
          const gen = Math.max(...state.creatives.map((c) => c.generation)) + 1;
          const attrs = nextAttribute(set, state.creatives, winner, gen);
          if (attrs) {
            const changed = (Object.keys(attrs) as (keyof CreativeAttributes)[]).find((k) => attrs[k] !== winner.attributes[k])!;
            const copy = writeCreative(profile, camp.platform, attrs, plan.settings.tone, plan.settings.emphasis);
            const photo = camp.platform === "meta" ? pickPhoto(profile.photos.photos, attrs.visual, gen) : undefined;
            const fresh: Creative = { id: `cr_${camp.platform[0]}v${state.creatives.length + 1}`, platform: camp.platform, format: winner.format, ...copy, attributes: photo || camp.platform === "google" ? attrs : { ...attrs, visual: "type_only" }, photoId: photo?.id, generation: gen, parentId: winner.id, createdDay: day + 1, policy: { ok: true, notes: [] } };
            fresh.policy = policyCheck(profile, fresh);
            const verdict = checkNewCreative(m, fresh);
            const duplicate = state.creatives.some((c) => c.platform === fresh.platform && c.headline === fresh.headline && c.body === fresh.body);
            if (verdict.ok && !duplicate) {
              state.creatives.push(fresh);
              set.ads.push({ id: `ad_${fresh.id.slice(3)}`, creativeId: fresh.id, status: "active", launchedDay: day + 1 });
              logAction(state, { day, actor: "CreativeProducer", kind: "creative_added", title: `Started testing a new ad: “${fresh.headline}”`, reason: `It keeps what works in the current best ad (“${winner.headline}”) and changes one thing: ${String(changed)} is now “${ATTRIBUTE_LABEL[attrs[changed] as string].toLowerCase()}”. It passed the brand and platform policy checks and uses only offers already in your plan.` });
            } else if (!verdict.ok) logAction(state, { day, actor: "CreativeProducer", kind: "creative_blocked", title: "Held back a new ad", reason: verdict.reason });
          }
        }
      }
    }

    // --- Budget between ad sets on this platform (bounded Thompson allocation). ---
    if (sets.length >= 2 && pClicks >= MIN_CLICKS_TO_ACT && day >= 6 && day % BUDGET_STEP_EVERY === 0) {
      const arms = sets.map((s) => arm(s.id, s.name, recent, (f) => f.adSetId === s.id));
      const est = estimate(arms, pooledPrior(arms, PLATFORM_PRIOR[camp.platform]), `${state.id}:${day}:${camp.id}`);
      const current = sets.map((s) => s.dailyBudget);
      const total = current.reduce((a, b) => a + b, 0);
      const locked = sets.map((s) => day - s.lastSignificantEditDay < LEARNING_DAYS);
      const next = allocate({ current, pBest: est.map((e) => e.pBest), total, explorationShare: plan.budget.explorationShare * 2, maxShift: Math.min(m.bounds.intraPlatformDailyShiftPct / 100, GENTLE_STEP), locked, minBudget: Math.floor(total * 0.1) });
      const biggest = Math.max(...next.map((n, i) => Math.abs(n - current[i]) / Math.max(1, current[i])));
      const ok = next.every((n, i) => checkIntraShift(m, current[i], n, 1).ok);
      if (ok && biggest >= 0.06) {
        sets.forEach((s, i) => {
          if (Math.abs(next[i] - s.dailyBudget) / Math.max(1, s.dailyBudget) > 0.2) s.lastSignificantEditDay = day + 1;
          s.dailyBudget = next[i];
        });
        const up = est.map((e, i) => ({ e, i })).sort((a, b) => next[b.i] - current[b.i] - (next[a.i] - current[a.i]))[0];
        const down = est.map((e, i) => ({ e, i })).sort((a, b) => next[a.i] - current[a.i] - (next[b.i] - current[b.i]))[0];
        const cpr = (e: ArmEstimate) => (e.costPerResult ? `about ${fmtUsd(Math.round(e.costPerResult * 1e6))} per ${goal.result}` : "not enough results to price yet");
        logAction(state, {
          day,
          actor: "Optimizer",
          kind: "budget_shift",
          title: `Moved ${fmtUsd(next[up.i] - current[up.i])} a day toward “${up.e.label}” on ${PLATFORM_LABEL[camp.platform]}`,
          reason: `“${up.e.label}” is at ${cpr(up.e)} and has a ${(up.e.pBest * 100).toFixed(0)}% chance of being the cheaper audience. “${down.e.label}” is at ${cpr(down.e)}. The step is kept small on purpose, well inside the ${m.bounds.intraPlatformDailyShiftPct}% a day you allowed, because big jumps make the platform start learning again. Every audience keeps some budget so we keep learning.`,
          amount: next[up.i] - current[up.i],
        });
        state.decisions.push({
          id: shortId("dec"),
          day,
          scope: `platform:${camp.platform}`,
          inputs: { platform: camp.platform, dailyBudget: toUsd(total), windowDays: 28, maxShiftPct: m.bounds.intraPlatformDailyShiftPct },
          estimates: est.map((e) => ({ label: e.label, costPerResult: e.costPerResult, pBest: e.pBest, spend: e.spend, results: e.results })),
          alternatives: ["Leave budgets as they are", "Move everything to the leading audience (rejected: too little data, and it would stop learning)"],
          action: sets.map((s, i) => `${s.name}: ${fmtUsd(current[i])} → ${fmtUsd(next[i])} a day`).join("; "),
          expected: `Lower cost per ${goal.result} on ${PLATFORM_LABEL[camp.platform]} over the next week.`,
        });
      }
    }
  }

  // --- Weekly: budget between platforms, on the same goal. ---
  const live = state.campaigns.filter((c) => c.status === "active");
  if (day % 7 === 6 && day >= 13 && live.length === 2) {
    const window = facts.filter((f) => f.day > day - 21);
    const arms = PLATFORMS.map((p) => arm(p, PLATFORM_LABEL[p], window, (f) => f.platform === p));
    if (arms.every((a) => a.clicks >= MIN_CLICKS_TO_ACT / 2)) {
      const blended = { cvr: (PLATFORM_PRIOR.google.cvr + PLATFORM_PRIOR.meta.cvr) / 2, cpc: (PLATFORM_PRIOR.google.cpc + PLATFORM_PRIOR.meta.cpc) / 2 };
      const est = estimate(arms, { ...blended, strength: 10 }, `${state.id}:${day}:cross`);
      const current = PLATFORMS.map((p) => platformDaily(state, p));
      const total = current.reduce((a, b) => a + b, 0);
      const next = allocate({ current, pBest: est.map((e) => e.pBest), total, explorationShare: plan.budget.explorationShare * 2, maxShift: m.bounds.crossPlatformWeeklyShiftPct / 100, maxShare: m.bounds.maxPlatformSharePct / 100 });
      const before = { google: current[0], meta: current[1] } as Record<Platform, Micro>;
      const after = { google: next[0], meta: next[1] } as Record<Platform, Micro>;
      const verdict = checkPlatformShares(m, before, after);
      const moved = Math.abs(next[0] - current[0]);
      if (verdict.ok && moved / Math.max(1, total) >= 0.03) {
        PLATFORMS.forEach((p, i) => {
          const camp = state.campaigns.find((c) => c.platform === p)!;
          const sets = activeSets(camp);
          const split = splitByWeights(next[i], sets.map((s) => Math.max(1, s.dailyBudget)));
          sets.forEach((s, k) => (s.dailyBudget = split[k]));
        });
        const toIdx = next[0] > current[0] ? 0 : 1;
        const to = est[toIdx];
        const from = est[1 - toIdx];
        const cpr = (e: ArmEstimate) => (e.costPerResult ? fmtUsd(Math.round(e.costPerResult * 1e6)) : "unknown");
        logAction(state, {
          day,
          actor: "Optimizer",
          kind: "platform_shift",
          title: `Moved ${fmtUsd(moved)} a day from ${from.label} to ${to.label}`,
          reason: `Over the last three weeks a ${goal.result} cost about ${cpr(to)} on ${to.label} and ${cpr(from)} on ${from.label}, counting results the same way on both (after a click, within seven days). ${to.label} is more likely the cheaper one (${(to.pBest * 100).toFixed(0)}%). The move is inside your ${m.bounds.crossPlatformWeeklyShiftPct}% a week limit and no platform goes above ${m.bounds.maxPlatformSharePct}%.`,
          amount: moved,
        });
        state.decisions.push({
          id: shortId("dec"),
          day,
          scope: "cross",
          inputs: { windowDays: 21, attribution: "click, 7 days, on both platforms", maxShiftPct: m.bounds.crossPlatformWeeklyShiftPct },
          estimates: est.map((e) => ({ label: e.label, costPerResult: e.costPerResult, pBest: e.pBest, spend: e.spend, results: e.results })),
          alternatives: ["Keep the split", "Move the maximum allowed regardless of confidence"],
          action: PLATFORMS.map((p, i) => `${PLATFORM_LABEL[p]}: ${fmtUsd(current[i])} → ${fmtUsd(next[i])} a day`).join("; "),
          expected: `More ${goal.results} for the same money over the next week.`,
        });
      } else if (!verdict.ok) logAction(state, { day, actor: "Optimizer", kind: "blocked", title: "Held back a budget move between platforms", reason: verdict.reason });
    }
  }

  // --- Score our own past decisions a week later. ---
  for (const d of state.decisions) {
    if (d.outcome || day < d.day + 7) continue;
    const scope = (f: MetricFact) => (d.scope === "cross" ? true : d.scope.startsWith("platform:") ? f.platform === d.scope.slice(9) : f.adSetId === d.scope.slice(6));
    const before = sumFacts(facts, (f) => scope(f) && f.day > d.day - 7 && f.day <= d.day);
    const after = sumFacts(facts, (f) => scope(f) && f.day > d.day && f.day <= d.day + 7);
    if (before.results === 0 || after.results === 0) d.outcome = { day, text: "Too few results in the week either side to judge this one.", better: null };
    else {
      const b = before.spend / before.results;
      const a = after.spend / after.results;
      d.outcome = { day, text: `Cost per ${goal.result} went from ${fmtUsd(Math.round(b))} the week before to ${fmtUsd(Math.round(a))} the week after.`, better: a < b };
    }
  }
}

export async function completeCampaign(state: BusinessState): Promise<void> {
  const chain = chainFor(state);
  for (const c of state.campaigns) c.status = "ended";
  await billDue(state, chain, state.day, { force: true });
  if (state.mandate) state.mandate.status = "completed";
  await syncAllowance(state, chain, "The approved time frame has ended.");
  await settleOps(state, chain);
  state.status = "completed";
  const left = state.wallet ? await chain.balance(state.wallet.address) : 0;
  logAction(state, { actor: "Treasurer", kind: "completed", severity: "notice", title: "The campaign reached its end date", reason: `All ads are stopped, the last bills are paid and the card's spending limit is removed. ${fmtUsd(left)} is left in the wallet for you to withdraw or put toward a renewal.` });
  await reconcile(state, chain, state.day);
}

export interface RunOptions {
  fault?: SimInput["fault"];
}

/** One campaign day: pace, deliver (simulated market), bill, optimise, report, reconcile. */
export async function runDay(state: BusinessState, opts: RunOptions = {}): Promise<void> {
  if (!mandateActive(state)) throw new Error("Nothing is running");
  const m = state.mandate!;
  const profile = latestProfile(state)!;
  const plan = latestPlan(state)!;
  const chain = chainFor(state);
  const day = state.day;
  if (day >= m.days) return completeCampaign(state);

  if (day > 0 && day % 30 === 0) await payFromWallet(state, chain, ACCOUNTS.subscription, plan.budget.subscriptionMonthly, `Storefront subscription, month ${day / 30 + 1}`, "The flat $20 a month for running your marketing.");

  paceBudgets(state, day);
  const violations = await invariantViolations(state, chain);
  if (violations.length) {
    for (const c of state.campaigns) if (c.status === "active") c.status = "paused";
    logAction(state, { day, actor: "Treasurer", kind: "invariant", severity: "alert", title: "Paused everything: a money safety check failed", reason: violations.join(". ") });
  }

  const facts = simulateDay({ seed: state.id, day, weekday: weekdayForDay(profile.budget.startDate, day), goal: profile.budget.goal, campaigns: state.campaigns, creatives: state.creatives, history: state.facts, fault: opts.fault });
  state.facts.push(...facts);
  for (const p of PLATFORMS) accrueAdSpend(state, p, facts.filter((f) => f.platform === p).reduce((a, f) => a + f.spend, 0), day);

  await billDue(state, chain, day);
  await optimise(state, day);
  accrueOps(state, OPS_COST.optimise, "Daily optimisation");

  state.day = day + 1;
  if (state.day % 7 === 0) {
    state.reports.push(weeklyReport(state));
    accrueOps(state, OPS_COST.report + OPS_COST.curate, "Weekly report and dashboard review");
    await settleOps(state, chain);
    state.dashboard = curateDashboard(state);
  } else if (!state.dashboard || state.day === 3) state.dashboard = curateDashboard(state);

  paceBudgets(state, state.day);
  await syncAllowance(state, chain, "Kept the card's limit in line with what is owed plus the rest of this month's budget.");
  await reconcile(state, chain, day);
  if (state.day >= m.days) await completeCampaign(state);
}

export async function runDays(state: BusinessState, n: number, opts: RunOptions = {}): Promise<number> {
  let ran = 0;
  for (let i = 0; i < n; i++) {
    if (!mandateActive(state)) break;
    await runDay(state, opts);
    ran++;
  }
  return ran;
}
