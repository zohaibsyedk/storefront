import { ATTRIBUTE_LABEL, GOAL_LABEL, PLATFORMS, PLATFORM_LABEL, fmtUsd, shortId, toUsd, type BusinessState, type DashboardSpec, type Insight, type InsightCitation, type MetricFact, type Widget, type WeeklyReport } from "@storefront/core";

function sum(facts: MetricFact[], pred: (f: MetricFact) => boolean) {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let results = 0;
  for (const f of facts) if (pred(f)) ((spend += f.spend), (impressions += f.impressions), (clicks += f.clicks), (results += f.results));
  return { spend, impressions, clicks, results };
}

/** Recompute a cited number straight from the stored facts. */
export function metricValue(facts: MetricFact[], c: Pick<InsightCitation, "metric" | "scope">): number {
  const s = sum(facts, (f) => f.day >= c.scope.fromDay && f.day <= c.scope.toDay && (!c.scope.platform || f.platform === c.scope.platform) && (!c.scope.creativeId || f.creativeId === c.scope.creativeId));
  switch (c.metric) {
    case "spend":
      return toUsd(s.spend);
    case "results":
      return s.results;
    case "clicks":
      return s.clicks;
    case "impressions":
      return s.impressions;
    case "cpr":
      return s.results ? toUsd(s.spend) / s.results : 0;
    case "ctr":
      return s.impressions ? s.clicks / s.impressions : 0;
  }
}

/** An insight is only shown if every number it cites matches the database. */
export function validateInsight(facts: MetricFact[], insight: Insight): Insight {
  const ok = insight.citations.every((c) => {
    const actual = metricValue(facts, c);
    return Math.abs(actual - c.value) <= Math.max(0.005, Math.abs(actual) * 0.005);
  });
  return { ...insight, validated: ok };
}

function cite(facts: MetricFact[], label: string, metric: InsightCitation["metric"], scope: InsightCitation["scope"]): InsightCitation {
  return { label, metric, scope, value: metricValue(facts, { metric, scope }) };
}
const money = (n: number) => `$${n.toFixed(2)}`;

function buildInsights(state: BusinessState): Insight[] {
  const facts = state.facts;
  const day = state.day;
  if (day < 3 || facts.length === 0) return [];
  const goal = GOAL_LABEL[state.profiles[state.profiles.length - 1].budget.goal];
  const all = { fromDay: 0, toDay: day - 1 };
  const out: Insight[] = [];
  const g = cite(facts, "Google cost per result", "cpr", { ...all, platform: "google" });
  const m = cite(facts, "Facebook and Instagram cost per result", "cpr", { ...all, platform: "meta" });
  if (g.value > 0 && m.value > 0) {
    const cheaper = g.value < m.value ? "Google Search" : "Facebook and Instagram";
    const lo = Math.min(g.value, m.value);
    const hi = Math.max(g.value, m.value);
    out.push({ id: shortId("ins"), day, text: `${cheaper} is bringing ${goal.results} for less so far: ${money(lo)} each against ${money(hi)} on the other platform.`, citations: [g, m], validated: false });
  }
  const byCreative = new Map<string, { spend: number; results: number; clicks: number }>();
  for (const f of facts) {
    const c = byCreative.get(f.creativeId) ?? { spend: 0, results: 0, clicks: 0 };
    c.spend += f.spend;
    c.results += f.results;
    c.clicks += f.clicks;
    byCreative.set(f.creativeId, c);
  }
  const ranked = [...byCreative.entries()].filter(([, v]) => v.results >= 3).sort((a, b) => a[1].spend / a[1].results - b[1].spend / b[1].results);
  if (ranked.length >= 2) {
    const best = state.creatives.find((c) => c.id === ranked[0][0]);
    if (best) {
      const c1 = cite(facts, "Best ad cost per result", "cpr", { ...all, creativeId: best.id });
      const c2 = cite(facts, "Best ad results", "results", { ...all, creativeId: best.id });
      out.push({ id: shortId("ins"), day, text: `Your strongest ad is “${best.headline}”: ${c2.value} ${c2.value === 1 ? goal.result : goal.results} at ${money(c1.value)} each. It ${ATTRIBUTE_LABEL[best.attributes.hook].toLowerCase()}.`, citations: [c1, c2], validated: false });
    }
  }
  if (day >= 14) {
    const a = cite(facts, "Cost per result, last 7 days", "cpr", { fromDay: day - 7, toDay: day - 1 });
    const b = cite(facts, "Cost per result, 7 days before", "cpr", { fromDay: day - 14, toDay: day - 8 });
    if (a.value > 0 && b.value > 0) out.push({ id: shortId("ins"), day, text: a.value < b.value ? `Each ${goal.result} cost ${money(a.value)} this week, down from ${money(b.value)} the week before.` : `Each ${goal.result} cost ${money(a.value)} this week, up from ${money(b.value)} the week before. Small weekly swings are normal at this budget.`, citations: [a, b], validated: false });
  }
  return out.map((i) => validateInsight(facts, i)).filter((i) => i.validated);
}

/**
 * The agent never writes chart code. It picks from a fixed widget library and says why.
 * Core widgets are a transparency floor it cannot remove.
 */
export function curateDashboard(state: BusinessState): DashboardSpec {
  const profile = state.profiles[state.profiles.length - 1];
  const goal = GOAL_LABEL[profile.budget.goal];
  const facts = state.facts;
  const day = state.day;
  const results = facts.reduce((a, f) => a + f.results, 0);
  const stage: DashboardSpec["stage"] = day < 10 || results < 25 ? "learning" : "optimizing";
  const core: Widget[] = [
    { id: "pacing", type: "pacing", title: "Spend against budget", core: true },
    { id: "kpi", type: "kpi", title: `${goal.results[0].toUpperCase()}${goal.results.slice(1)} and what each one costs`, core: true },
    { id: "wallet", type: "wallet", title: "Wallet", core: true },
    { id: "actions", type: "actions", title: "What your marketer did last", core: true },
  ];
  const picks: Widget[] = [];
  const insights = buildInsights(state);
  if (insights.length) picks.push({ id: "insight", type: "insight", title: "What the numbers say", core: false, why: "Every figure here is checked against the raw data before it is shown." });
  picks.push({ id: "timeseries", type: "timeseries", title: `${goal.results[0].toUpperCase()}${goal.results.slice(1)} per day`, core: false, why: stage === "learning" ? "In the first weeks the daily trend shows whether the ads are getting traction at all." : "The trend shows whether the budget moves are paying off." });
  if (day >= 5) picks.push({ id: "platform_compare", type: "platform_compare", title: "Google against Facebook and Instagram", core: false, why: "This comparison decides where next week's money goes." });
  if (facts.length && day >= 4) picks.push({ id: "creative_leaderboard", type: "creative_leaderboard", title: "Which ads are working", core: false, why: stage === "learning" ? "Shows which messages people respond to first." : "Paused and promoted ads come from this ranking." });
  if (stage === "optimizing") picks.push({ id: "attribute_wins", type: "attribute_wins", title: "What kind of ad wins", core: false, why: "New ads are built from the ingredients that score best here." });
  if ((profile.budget.goal === "foot_traffic" || profile.budget.goal === "bookings" || profile.budget.goal === "calls") && day >= 14) picks.push({ id: "weekday", type: "weekday", title: "Best days of the week", core: false, why: `${goal.results[0].toUpperCase()}${goal.results.slice(1)} depend on when you are open, so the day pattern matters for you.` });
  if (profile.budget.goal === "online_orders" || profile.budget.goal === "leads" || stage === "optimizing") picks.push({ id: "funnel", type: "funnel", title: "From seeing an ad to acting on it", core: false, why: "Shows where people drop off between seeing, clicking and acting." });
  if (state.actions.filter((a) => a.actor === "Optimizer" || a.actor === "CreativeProducer").length >= 2) picks.push({ id: "what_changed", type: "what_changed", title: "Changes over time", core: false, why: "Lines up each change the agent made with what happened afterwards." });

  // Keep the layout stable: widgets that were already shown keep their order, new ones go last.
  const prev = state.dashboard?.widgets.filter((w) => !w.core).map((w) => w.id) ?? [];
  picks.sort((a, b) => {
    const ia = prev.indexOf(a.id);
    const ib = prev.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return { version: (state.dashboard?.version ?? 0) + 1, curatedDay: day, stage, widgets: [...core, ...picks], insights };
}

export function weeklyReport(state: BusinessState): WeeklyReport {
  const day = state.day;
  const week = Math.ceil(day / 7);
  const profile = state.profiles[state.profiles.length - 1];
  const goal = GOAL_LABEL[profile.budget.goal];
  const wk = sum(state.facts, (f) => f.day >= day - 7 && f.day < day);
  const prev = sum(state.facts, (f) => f.day >= day - 14 && f.day < day - 7);
  const acts = state.actions.filter((a) => a.day >= day - 7 && a.day < day && (a.actor === "Optimizer" || a.actor === "CreativeProducer"));
  const happened = [`${wk.results} ${wk.results === 1 ? goal.result : goal.results} from ${wk.clicks} clicks and ${wk.impressions.toLocaleString("en-US")} views.`, wk.results ? `Each ${goal.result} cost ${fmtUsd(Math.round(wk.spend / wk.results))}${prev.results ? `, against ${fmtUsd(Math.round(prev.spend / prev.results))} the week before` : ""}.` : `No ${goal.results} recorded yet this week.`];
  for (const p of PLATFORMS) {
    const s = sum(state.facts, (f) => f.day >= day - 7 && f.day < day && f.platform === p);
    happened.push(`${PLATFORM_LABEL[p]}: ${fmtUsd(s.spend)} spent, ${s.results} ${s.results === 1 ? goal.result : goal.results}.`);
  }
  const next: string[] = [];
  if (day < 14) next.push("Keep all ads running while the platforms finish learning; no big changes yet.");
  else next.push("Keep moving budget toward the audiences and ads with the lowest cost per result, within your limits.");
  if (state.campaigns.some((c) => c.status === "paused")) next.push("One platform is paused by a safety check and needs your OK to resume.");
  const todo = state.ownerTasks.filter((t) => t.status === "todo");
  if (todo.length) next.push(`Waiting on you: ${todo.map((t) => t.title.toLowerCase()).join("; ")}.`);
  return {
    id: shortId("rep"),
    week,
    day,
    headline: wk.results ? `Week ${week}: ${wk.results} ${goal.results} for ${fmtUsd(wk.spend)}` : `Week ${week}: ${fmtUsd(wk.spend)} spent, still gathering results`,
    happened,
    changed: acts.length ? acts.map((a) => `${a.title}. ${a.reason}`) : ["Nothing changed this week. There was not enough new evidence to justify a move."],
    next,
    spent: wk.spend,
    results: wk.results,
  };
}
