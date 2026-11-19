"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { fmtUsd } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { ErrorNote, Loading } from "@/components/ui";
import { WidgetView } from "@/components/widgets";

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const { view, error, act, busy } = useBusiness(id);
  const [confirmKill, setConfirmKill] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (!view) return error ? <ErrorNote>{error}</ErrorNote> : <Loading what="Opening your dashboard" />;
  const { state, money } = view;
  if (!state.mandate || !state.dashboard)
    return (
      <p className="py-10">
        Nothing is running yet. <Link className="link" href={`/b/${id}/plan`}>Open your plan</Link>
      </p>
    );
  const live = state.status === "live";
  const spec = state.dashboard;
  const core = spec.widgets.filter((w) => w.core);
  const picked = spec.widgets.filter((w) => !w.core);
  const todo = state.ownerTasks.filter((t) => t.status === "todo");
  const report = state.reports.at(-1);
  const rec = state.reconciliations.at(-1);
  const pausedByGuard = state.campaigns.filter((c) => c.status === "paused" && live);
  const running = busy === "runDays";

  return (
    <div className="py-6">
      {live && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-dashed border-blue bg-white px-4 py-3">
          <p className="mr-auto">
            <strong>Test market.</strong> <span className="hint">Results are simulated, so you move time forward yourself.</span>
          </p>
          {[1, 7, 30].map((n) => (
            <button key={n} className="btn btn-quiet min-h-10 px-3 text-base" disabled={running} onClick={() => act("runDays", { days: n })}>
              {running ? "Running" : n === 1 ? "Run 1 day" : `Run ${n} days`}
            </button>
          ))}
        </div>
      )}

      {state.status === "stopped" && state.killed && (
        <section className="mt-4 rounded-[14px] border-[1.5px] border-brick bg-brick-soft p-5">
          <h2>Everything is stopped</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {state.killed.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3">
            {fmtUsd(money.wallet)} is left in the wallet.{" "}
            {money.wallet > 0 ? (
              <button className="link" disabled={busy === "withdraw"} onClick={() => act("withdraw")}>
                Send it back to me
              </button>
            ) : (
              money.refunded > 0 && `${fmtUsd(money.refunded)} was returned to you.`
            )}
          </p>
        </section>
      )}
      {state.status === "completed" && (
        <section className="mt-4 rounded-[14px] border-[1.5px] border-ink bg-marigold-soft p-5">
          <h2>The campaign has finished</h2>
          <p className="mt-2">
            Ads are off, the last bills are paid and the card has no spending limit. {fmtUsd(money.wallet)} is left in the wallet.{" "}
            {money.wallet > 0 && (
              <button className="link" disabled={busy === "withdraw"} onClick={() => act("withdraw")}>
                Send it back to me
              </button>
            )}
          </p>
        </section>
      )}
      {pausedByGuard.length > 0 && (
        <section className="mt-4 rounded-[14px] border-[1.5px] border-brick bg-brick-soft p-4">
          <p className="font-bold">A safety check paused {pausedByGuard.map((c) => (c.platform === "google" ? "Google Search" : "Facebook and Instagram")).join(" and ")}.</p>
          <p>{state.actions.filter((a) => a.kind === "guard_pause").at(-1)?.reason}</p>
        </section>
      )}
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <section className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2" aria-label="Always shown">
        {core.map((w) => (
          <div key={w.id} className={w.type === "pacing" || w.type === "kpi" ? "" : "rule pt-6 md:border-0 md:pt-0"}>
            <h3 className="text-muted">{w.title}</h3>
            <div className="mt-2">
              <WidgetView w={w} view={view} id={id} />
            </div>
          </div>
        ))}
      </section>

      {todo.length > 0 && (
        <section className="mt-10 rounded-[14px] bg-marigold-soft p-5">
          <h2>Waiting on you</h2>
          <ul className="mt-3 space-y-4">
            {todo.map((t) => (
              <li key={t.id}>
                <p className="font-bold">{t.title}</p>
                <p>{t.why}</p>
                <details className="mt-1">
                  <summary className="link">How to do it</summary>
                  <ol className="mt-1 list-decimal pl-5">
                    {t.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </details>
                <button className="link mt-1" onClick={() => act("taskDone", { taskId: t.id })}>
                  I have done this
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2>Chosen for you this week</h2>
        <p className="hint mt-1">
          Your marketer picks what to show based on your goal and what is driving its decisions right now ({spec.stage === "learning" ? "still learning what works" : "optimising"}). Last reviewed on day {spec.curatedDay}.
        </p>
        <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
          {picked.map((w) => (
            <article key={w.id} className={`panel ${w.type === "timeseries" || w.type === "insight" ? "md:col-span-2" : ""}`}>
              <h3 className="text-xl">{w.title}</h3>
              {w.why && <p className="hint">{w.why}</p>}
              <div className="mt-3">
                <WidgetView w={w} view={view} id={id} />
              </div>
            </article>
          ))}
        </div>
        <button className="link mt-4" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? "Hide" : "Show"} all metrics
        </button>
        {showAll && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left num">
              <thead>
                <tr className="hint">
                  <th className="py-1 font-normal">Ad</th>
                  <th className="py-1 text-right font-normal">Views</th>
                  <th className="py-1 text-right font-normal">Clicks</th>
                  <th className="py-1 text-right font-normal">Results</th>
                  <th className="py-1 text-right font-normal">Spend</th>
                </tr>
              </thead>
              <tbody>
                {state.creatives.map((c) => {
                  let i = 0, k = 0, r = 0, s = 0;
                  for (const f of state.facts) {
                    if (f.creativeId !== c.id) continue;
                    i += f.impressions;
                    k += f.clicks;
                    r += f.results;
                    s += f.spend;
                  }
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-1.5 pr-2">
                        {c.headline} <span className="hint">({c.platform === "google" ? "Google" : "FB/IG"})</span>
                      </td>
                      <td className="py-1.5 text-right">{i.toLocaleString("en-US")}</td>
                      <td className="py-1.5 text-right">{k}</td>
                      <td className="py-1.5 text-right">{r}</td>
                      <td className="py-1.5 text-right">{fmtUsd(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report && (
        <section className="mt-12">
          <h2>{report.headline}</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {(
              [
                ["What happened", report.happened],
                ["What changed and why", report.changed],
                ["What is next", report.next],
              ] as const
            ).map(([t, items]) => (
              <div key={t}>
                <h3>{t}</h3>
                <ul className="mt-2 space-y-2">
                  {items.slice(0, 4).map((x) => (
                    <li key={x} className="line-clamp-5">{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rule mt-12 flex flex-wrap items-center gap-4 pt-6">
        {rec && (
          <p className="mr-auto">
            <span className={`tag ${rec.ok ? "tag-leaf" : "tag-brick"}`}>{rec.ok ? "Money check passed" : "Money check found a mismatch"}</span> <span className="hint">Ledger, wallet and ad platforms agree as of day {rec.day + 1}. </span>
            <Link className="link" href={`/b/${id}/wallet`}>
              Details
            </Link>
          </p>
        )}
        {live &&
          (confirmKill ? (
            <div className="rounded-xl border-[1.5px] border-brick bg-brick-soft p-4">
              <p className="font-bold">Stop all ads and lock the card?</p>
              <p className="hint">Ads pause now, the final bill for ads that already ran is paid, and the card loses its spending limit. Unspent money stays yours.</p>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-stop" disabled={busy === "kill"} onClick={() => act("kill")}>
                  {busy === "kill" ? "Stopping" : "Yes, stop everything"}
                </button>
                <button className="btn btn-quiet" onClick={() => setConfirmKill(false)}>
                  Keep running
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-stop" onClick={() => setConfirmKill(true)}>
              Stop everything
            </button>
          ))}
      </section>
    </div>
  );
}
