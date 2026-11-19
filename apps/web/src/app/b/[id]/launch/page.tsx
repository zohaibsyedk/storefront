"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtUsd } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { Check, ErrorNote, Loading, Receipt, Row } from "@/components/ui";

export default function LaunchPage() {
  const { id } = useParams<{ id: string }>();
  const { view, error, act, busy } = useBusiness(id);
  const [shown, setShown] = useState(0);
  const steps = view?.state.execution ?? [];
  const launched = view ? view.state.status !== "approved" && view.state.status !== "review" : false;
  useEffect(() => {
    if (!launched || shown >= steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 420);
    return () => clearTimeout(t);
  }, [launched, shown, steps.length]);
  if (!view) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />;
  const { state } = view;
  const plan = state.plans.at(-1);
  if (!plan || state.status === "review" || state.status === "onboarding")
    return (
      <p className="py-10">
        Approve your plan first. <Link className="link" href={`/b/${id}/plan`}>Open the plan</Link>
      </p>
    );
  const b = plan.budget;
  const allDone = launched && shown >= steps.length;
  return (
    <div className="grid gap-10 py-8 md:grid-cols-[1fr_1.1fr]">
      <div>
        <h1>{launched ? "Launched" : "Pay and launch"}</h1>
        <p className="mt-3 text-lg">{launched ? "Your money is in the agent wallet and the campaigns are running." : "One payment. We convert it to USDC and hold it in a wallet only your agent can spend from, inside the limits you approved."}</p>
        <div className="mt-6">
          <Receipt title="Order">
            <Row label="Marketing budget" value={fmtUsd(b.total)} note={`${fmtUsd(b.adSpend, { cents: false })} for ads, ${fmtUsd(b.opsReserve, { cents: false })} reserve for agent running costs`} />
            <Row label={`Storefront, $20 a month × ${b.months}`} value={fmtUsd(b.subscriptionMonthly * b.months)} />
            {b.fees.map((f) => (
              <Row key={f.id} label={f.label} value={fmtUsd(f.amount)} />
            ))}
            <Row label="Total today" value={fmtUsd(b.dueAtApproval)} total />
          </Receipt>
        </div>
        {!launched && (
          <div className="mt-8">
            <button className="btn w-full" disabled={busy === "launch"} onClick={() => act("launch")}>
              {busy === "launch" ? "Working" : `Pay ${fmtUsd(b.dueAtApproval)} and launch`}
            </button>
            <p className="hint mt-3">Test mode: no real card is charged and the USDC is test money. Stop any time and whatever is unspent stays yours.</p>
          </div>
        )}
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </div>
      <div>
        <h2>What happens next</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => {
            const visible = launched && i < shown;
            const done = visible && s.status === "done";
            const owner = visible && s.status === "owner_task";
            const failed = visible && s.status === "failed";
            return (
              <li key={s.id} className="flex gap-3">
                <span className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full border-2 ${done ? "border-leaf bg-leaf text-white" : owner ? "border-marigold bg-marigold" : failed ? "border-brick bg-brick text-white" : "border-line bg-white"}`}>{done ? <Check /> : owner ? "!" : failed ? "×" : ""}</span>
                <span>
                  <span className={`block font-bold ${visible ? "" : "text-muted"}`}>{s.label}</span>
                  {visible && s.detail && <span className="hint block">{s.detail}</span>}
                  {visible && s.txSig && <span className="hint block break-all text-xs num">Transaction {s.txSig}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {allDone && (
          <div className="mt-8">
            {state.ownerTasks.filter((t) => t.status === "todo").length > 0 && (
              <div className="mb-5 rounded-xl bg-marigold-soft p-4">
                <p className="font-bold">Waiting on you</p>
                <ul className="mt-1 list-disc pl-5">
                  {state.ownerTasks.filter((t) => t.status === "todo").map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link className="btn" href={`/b/${id}/dashboard`}>
              Go to your dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
