"use client";
import Link from "next/link";
import { ATTRIBUTE_LABEL, DAYS, DAY_LABEL, GOAL_LABEL, PLATFORMS, PLATFORM_LABEL, dateForDay, fmtUsd, weekdayForDay, type MetricFact, type Platform, type Widget } from "@storefront/core";
import type { BusinessView } from "@/lib/api";

const PCOLOR: Record<Platform, string> = { google: "var(--blue)", meta: "var(--ink)" };
const pname = (p: Platform) => PLATFORM_LABEL[p];

function agg(facts: MetricFact[], pred: (f: MetricFact) => boolean = () => true) {
  let spend = 0, impressions = 0, clicks = 0, results = 0;
  for (const f of facts) {
    if (!pred(f)) continue;
    spend += f.spend;
    impressions += f.impressions;
    clicks += f.clicks;
    results += f.results;
  }
  return { spend, impressions, clicks, results, cpr: results ? spend / results : 0 };
}
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function HBar({ label, value, max, text, color = "var(--blue)" }: { label: string; value: number; max: number; text: string; color?: string }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">{label}</span>
        <span className="num flex-none font-bold">{text}</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-sky">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
      </div>
    </div>
  );
}

export function WidgetView({ w, view, id }: { w: Widget; view: BusinessView; id: string }) {
  const { state, money } = view;
  const profile = state.profiles.at(-1)!;
  const goal = GOAL_LABEL[profile.budget.goal];
  const facts = state.facts;
  const m = state.mandate!;
  const day = state.day;
  const all = agg(facts);

  switch (w.type) {
    case "pacing": {
      const pct = Math.min(100, (money.adSpent / money.adBudget) * 100);
      const expected = Math.min(100, (day / m.days) * 100);
      const diff = pct - expected;
      return (
        <div>
          <p className="display text-4xl num">{fmtUsd(money.adSpent)}</p>
          <p>
            of {fmtUsd(money.adBudget, { cents: false })} for ads. {fmtUsd(money.adBudget - money.adSpent)} left.
          </p>
          <div className="relative mt-4 h-4 rounded-full bg-sky" role="img" aria-label={`${pct.toFixed(0)}% of the ad budget spent, ${expected.toFixed(0)}% of the time gone`}>
            <div className="h-full rounded-full bg-blue" style={{ width: `${pct}%` }} />
            <div className="absolute -top-1.5 h-7 w-[3px] bg-marigold" style={{ left: `${expected}%` }} />
          </div>
          <p className="hint mt-2">
            Day {day} of {m.days}. The yellow mark is where spending would be if it were perfectly even. {Math.abs(diff) < 4 ? "You are on pace." : diff < 0 ? "Slightly under pace; unspent money rolls forward." : "Slightly ahead of pace; the agent slows down to stay inside the budget."}
          </p>
        </div>
      );
    }
    case "kpi": {
      const wk = agg(facts, (f) => f.day >= day - 7);
      const prev = agg(facts, (f) => f.day >= day - 14 && f.day < day - 7);
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="display text-4xl num">{all.results}</p>
            <p>{goal.results} so far</p>
            {day >= 7 && <p className="hint num">{wk.results} in the last 7 days{prev.results ? `, ${prev.results} the week before` : ""}</p>}
          </div>
          <div>
            <p className="display text-4xl num">{all.results ? fmtUsd(Math.round(all.cpr)) : "n/a"}</p>
            <p>per {goal.result}</p>
            {day >= 14 && wk.results > 0 && prev.results > 0 && <p className={`num text-sm font-bold ${wk.cpr <= prev.cpr ? "text-leaf" : "text-brick"}`}>{fmtUsd(Math.round(wk.cpr))} this week, {wk.cpr <= prev.cpr ? "down" : "up"} from {fmtUsd(Math.round(prev.cpr))}</p>}
          </div>
        </div>
      );
    }
    case "wallet":
      return (
        <div>
          <p className="display text-4xl num">{fmtUsd(money.wallet)}</p>
          <p>in the agent wallet, held as USDC</p>
          <p className="hint mt-2 num">
            The card can take at most {fmtUsd(money.allowance)} of it. {fmtUsd(money.opsUsed)} of the {fmtUsd(money.opsReserve, { cents: false })} running-cost reserve is used.
          </p>
          <Link className="link mt-1 inline-block" href={`/b/${id}/wallet`}>
            See every payment
          </Link>
        </div>
      );
    case "actions": {
      const acts = state.actions.filter((a) => a.actor !== "Owner").slice(-3).reverse();
      return (
        <div>
          <ul className="space-y-3">
            {acts.map((a) => (
              <li key={a.id}>
                <p className="font-bold">{a.title}</p>
                <p className="hint line-clamp-2">{a.reason}</p>
              </li>
            ))}
          </ul>
          <Link className="link mt-2 inline-block" href={`/b/${id}/activity`}>
            See everything it has done
          </Link>
        </div>
      );
    }
    case "insight":
      return (
        <ul className="space-y-3 text-lg">
          {state.dashboard!.insights.map((i) => (
            <li key={i.id}>{i.text}</li>
          ))}
        </ul>
      );
    case "timeseries": {
      const days = Array.from({ length: Math.max(day, 1) }, (_, d) => agg(facts, (f) => f.day === d));
      const max = Math.max(1, ...days.map((d) => d.results));
      const W = 600, H = 150, bw = W / days.length;
      return (
        <div>
          <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-full" role="img" aria-label={`${goal.results} per day; the most in one day was ${max}`}>
            <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line)" strokeWidth="2" />
            {days.map((d, i) => {
              const h = (d.results / max) * (H - 10);
              return <rect key={i} x={i * bw + bw * 0.14} y={H - h} width={bw * 0.72} height={h} rx={Math.min(3, bw * 0.2)} fill="var(--blue)"><title>{`${shortDate(dateForDay(profile.budget.startDate, i))}: ${d.results} ${goal.results}, ${fmtUsd(d.spend)} spent`}</title></rect>;
            })}
          </svg>
          <div className="hint flex justify-between num">
            <span>{shortDate(dateForDay(profile.budget.startDate, 0))}</span>
            <span>most in a day: {max}</span>
            <span>{shortDate(dateForDay(profile.budget.startDate, Math.max(0, day - 1)))}</span>
          </div>
        </div>
      );
    }
    case "platform_compare": {
      const rows = PLATFORMS.map((p) => ({ p, ...agg(facts, (f) => f.platform === p), daily: state.campaigns.find((c) => c.platform === p)?.adSets.reduce((a, s) => a + (s.status === "active" ? s.dailyBudget : 0), 0) ?? 0 }));
      const maxCpr = Math.max(...rows.map((r) => r.cpr), 1);
      const totalDaily = rows.reduce((a, r) => a + r.daily, 0) || 1;
      return (
        <div>
          <p className="font-bold">Cost per {goal.result} (shorter is better)</p>
          {rows.map((r) => (
            <HBar key={r.p} label={pname(r.p)} value={r.cpr} max={maxCpr} text={r.results ? fmtUsd(Math.round(r.cpr)) : "no results yet"} color={PCOLOR[r.p]} />
          ))}
          <p className="mt-4 font-bold">Share of today&apos;s budget</p>
          <div className="mt-2 flex h-8 overflow-hidden rounded-lg text-sm font-bold text-white">
            {rows.map((r) => (
              <div key={r.p} className="grid place-items-center num" style={{ width: `${(r.daily / totalDaily) * 100}%`, background: PCOLOR[r.p] }}>
                {Math.round((r.daily / totalDaily) * 100)}%
              </div>
            ))}
          </div>
          <p className="hint mt-1">
            {rows.map((r) => `${pname(r.p)}: ${r.results} ${goal.results} from ${fmtUsd(r.spend)}`).join(". ")}.
          </p>
        </div>
      );
    }
    case "creative_leaderboard": {
      const rows = state.creatives
        .map((c) => {
          const ad = state.campaigns.flatMap((x) => x.adSets.flatMap((s) => s.ads)).find((a) => a.creativeId === c.id);
          return { c, ad, ...agg(facts, (f) => f.creativeId === c.id) };
        })
        .filter((r) => r.impressions > 0)
        .sort((a, b) => (a.results && b.results ? a.cpr - b.cpr : b.results - a.results || b.clicks - a.clicks))
        .slice(0, 6);
      return (
        <table className="w-full text-left">
          <thead>
            <tr className="hint">
              <th className="pb-1 font-normal">Ad</th>
              <th className="pb-1 pl-3 text-right font-normal">{goal.results[0].toUpperCase() + goal.results.slice(1)}</th>
              <th className="pb-1 pl-3 text-right font-normal">Each</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c.id} className="border-t-[1.5px] border-line align-top">
                <td className="py-2 pr-2">
                  <span className="block font-bold leading-snug">{r.c.headline}</span>
                  <span className="hint text-sm">
                    {r.c.platform === "google" ? "Google" : "Facebook/Instagram"}, {ATTRIBUTE_LABEL[r.c.attributes.hook].toLowerCase()}
                  </span>{" "}
                  {r.ad?.status === "paused" && <span className="tag tag-brick">Paused</span>} {r.c.generation > 0 && <span className="tag tag-gold">New test</span>}
                </td>
                <td className="py-2 pl-3 text-right num">{r.results}</td>
                <td className="py-2 pl-3 text-right num font-bold">{r.results ? fmtUsd(Math.round(r.cpr)) : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "attribute_wins": {
      const by = new Map<string, MetricFact[]>();
      for (const f of facts) {
        const c = state.creatives.find((x) => x.id === f.creativeId);
        if (!c) continue;
        const k = c.attributes.hook;
        by.set(k, [...(by.get(k) ?? []), f]);
      }
      const rows = [...by.entries()].map(([k, fs]) => ({ k, ...agg(fs) })).filter((r) => r.results > 0).sort((a, b) => a.cpr - b.cpr);
      const max = Math.max(...rows.map((r) => r.cpr), 1);
      return (
        <div>
          <p className="font-bold">How the ad opens, by cost per {goal.result}</p>
          {rows.map((r) => (
            <HBar key={r.k} label={ATTRIBUTE_LABEL[r.k]} value={r.cpr} max={max} text={fmtUsd(Math.round(r.cpr))} />
          ))}
        </div>
      );
    }
    case "weekday": {
      const rows = DAYS.map((d) => ({ d, ...agg(facts, (f) => weekdayForDay(profile.budget.startDate, f.day) === d) }));
      const max = Math.max(...rows.map((r) => r.results), 1);
      return (
        <div className="flex h-36 items-end gap-2" role="img" aria-label={`${goal.results} by day of the week`}>
          {rows.map((r) => (
            <div key={r.d} className="flex flex-1 flex-col items-center gap-1">
              <span className="num text-sm font-bold">{r.results}</span>
              <div className="w-full rounded-t-md bg-blue" style={{ height: `${(r.results / max) * 84}px`, minHeight: 2 }} />
              <span className="hint text-sm">{DAY_LABEL[r.d].slice(0, 3)}</span>
            </div>
          ))}
        </div>
      );
    }
    case "funnel": {
      const steps = [
        ["Saw an ad", all.impressions],
        ["Clicked", all.clicks],
        [`Became a ${goal.result}`, all.results],
      ] as const;
      return (
        <div>
          {steps.map(([l, v], i) => (
            <HBar key={l} label={l} value={Math.log10(v + 1)} max={Math.log10(all.impressions + 1)} text={`${v.toLocaleString("en-US")}${i > 0 && steps[i - 1][1] ? ` (${((v / steps[i - 1][1]) * 100).toFixed(1)}%)` : ""}`} />
          ))}
          <p className="hint mt-1">Bars are on a compressed scale so the small numbers stay visible.</p>
        </div>
      );
    }
    case "what_changed": {
      const acts = state.actions.filter((a) => ["budget_shift", "platform_shift", "ad_paused", "creative_added", "guard_pause", "schedule"].includes(a.kind)).slice(-6).reverse();
      const decisions = state.decisions.filter((d) => d.outcome && d.outcome.better !== null);
      const good = decisions.filter((d) => d.outcome!.better).length;
      return (
        <div>
          <ol className="space-y-2">
            {acts.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="hint w-14 flex-none num">Day {a.day + 1}</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ol>
          {decisions.length > 0 && (
            <p className="mt-3 rounded-lg bg-sky p-3">
              Track record: of {decisions.length} budget and ad decisions old enough to judge, cost per {goal.result} was lower the week after in {good}.
            </p>
          )}
        </div>
      );
    }
  }
}
