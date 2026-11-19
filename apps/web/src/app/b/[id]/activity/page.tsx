"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { fmtUsd } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { ErrorNote, Loading } from "@/components/ui";

const ROLE: Record<string, string> = { Strategist: "Planning", MediaBuyer: "Ads", Treasurer: "Money", CreativeProducer: "New ads", SiteBuilder: "Website", ListingsManager: "Listings", Optimizer: "Optimising", Owner: "You", Analyst: "Reporting" };
const FILTERS = ["Everything", "Optimising", "New ads", "Money", "You"];

export default function Activity() {
  const { id } = useParams<{ id: string }>();
  const { view, error } = useBusiness(id);
  const [filter, setFilter] = useState("Everything");
  const [tab, setTab] = useState<"log" | "decisions">("log");
  if (!view) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />;
  const { state } = view;
  const acts = state.actions.filter((a) => filter === "Everything" || ROLE[a.actor] === filter).slice().reverse();
  const decisions = state.decisions.slice().reverse();
  return (
    <div className="py-8">
      <h1>Everything your marketer has done</h1>
      <p className="mt-3 max-w-2xl text-lg">Each action is recorded when it happens, with the reason in plain words. Nothing is edited afterwards.</p>
      <div className="mt-6 flex gap-2" role="group" aria-label="View">
        <button className="chip" aria-pressed={tab === "log"} onClick={() => setTab("log")}>
          Activity ({state.actions.length})
        </button>
        <button className="chip" aria-pressed={tab === "decisions"} onClick={() => setTab("decisions")}>
          Decisions and how they turned out ({state.decisions.length})
        </button>
      </div>
      {tab === "log" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f} className="chip min-h-9 text-sm" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <ol className="mt-5 divide-y-[1.5px] divide-line rounded-[14px] bg-white">
            {acts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`tag ${a.severity === "alert" ? "tag-brick" : a.actor === "Owner" ? "tag-gold" : ""}`}>{ROLE[a.actor]}</span>
                  <span className="hint num">{state.status === "onboarding" || a.kind.startsWith("plan") ? new Date(a.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `Day ${a.day + 1}`}</span>
                  {typeof a.amount === "number" && a.amount > 0 && <span className="num ml-auto font-bold">{fmtUsd(a.amount)}</span>}
                </div>
                <p className="mt-1 font-bold">{a.title}</p>
                <p>{a.reason}</p>
                {a.txSig && <p className="hint break-all text-xs num">Transaction {a.txSig}</p>}
              </li>
            ))}
            {acts.length === 0 && <li className="px-4 py-6 text-muted">Nothing of this kind yet.</li>}
          </ol>
        </>
      ) : (
        <div className="mt-5 space-y-4">
          {decisions.length === 0 && <p className="text-muted">No budget or ad decisions yet. The agent waits until there is enough data to act on.</p>}
          {decisions.map((d) => (
            <article key={d.id} className="panel">
              <p className="hint num">Day {d.day + 1}</p>
              <h3 className="mt-1 text-lg">{d.action}</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm num">
                  <thead>
                    <tr className="hint">
                      <th className="font-normal">What it compared</th>
                      <th className="text-right font-normal">Spent</th>
                      <th className="text-right font-normal">Results</th>
                      <th className="text-right font-normal">Cost each</th>
                      <th className="text-right font-normal">Chance it is best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.estimates.map((e) => (
                      <tr key={e.label} className="border-t border-line">
                        <td className="py-1 pr-2">{e.label}</td>
                        <td className="py-1 text-right">${e.spend.toFixed(2)}</td>
                        <td className="py-1 text-right">{e.results}</td>
                        <td className="py-1 text-right">{e.costPerResult ? `$${e.costPerResult.toFixed(2)}` : "n/a"}</td>
                        <td className="py-1 text-right font-bold">{(e.pBest * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3">
                <strong>Expected:</strong> {d.expected}
              </p>
              <p className="hint">Also considered: {d.alternatives.join("; ")}.</p>
              <p className={`mt-2 rounded-lg p-2 ${d.outcome ? (d.outcome.better ? "bg-leaf-soft text-leaf" : d.outcome.better === false ? "bg-brick-soft text-brick" : "bg-sky") : "bg-sky"}`}>
                <strong>What happened:</strong> {d.outcome ? d.outcome.text : "Too soon to say. This is scored a week after the change."}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
