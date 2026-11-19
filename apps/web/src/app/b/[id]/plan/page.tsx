"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GOAL_LABEL, PLATFORM_LABEL, fmtUsd, type ChangeRequest, type LaunchPlan } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { AdPreview } from "@/components/AdPreview";
import { ART } from "@/components/art";
import { ErrorNote, Loading, Receipt, Row } from "@/components/ui";

function AskChange({ area, onSend, busy, placeholder }: { area: ChangeRequest["area"]; onSend: (area: ChangeRequest["area"], text: string) => Promise<void>; busy: boolean; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        Ask for a change
      </button>
    );
  return (
    <form
      className="mt-3 rounded-xl bg-marigold-soft p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSend(area, text);
        setText("");
        setOpen(false);
      }}
    >
      <label className="block">
        <span className="label">What should be different?</span>
        <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus />
      </label>
      <div className="mt-2 flex gap-2">
        <button className="btn" disabled={busy || !text.trim()}>
          {busy ? "Revising" : "Revise the plan"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rule py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { view, error, act, busy } = useBusiness(id);
  const [showDiff, setShowDiff] = useState(true);
  if (!view) return error ? <ErrorNote>{error}</ErrorNote> : <Loading what="Opening your plan" />;
  const { state } = view;
  const plan: LaunchPlan | undefined = state.plans.at(-1);
  const profile = state.profiles.at(-1);
  if (!plan || !profile)
    return (
      <div className="py-10">
        <h1>No plan yet</h1>
        <p className="mt-3">
          Finish telling us about your business and we will draft one. <Link className="link" href={`/onboarding/${id}`}>Continue setup</Link>
        </p>
      </div>
    );
  const review = state.status === "review";
  const goal = GOAL_LABEL[profile.budget.goal];
  const lastChange = state.changeRequests.at(-1);
  const send = async (area: ChangeRequest["area"], text: string) => {
    await act("change", { area, text });
    setShowDiff(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changing = busy === "change";
  const b = plan.budget;
  const photos = profile.photos.photos;

  return (
    <div className="pb-10">
      <div className="py-8">
        <p className="hint">
          Version {plan.version}
          {state.plans.length > 1 ? ` of ${state.plans.length}` : ""}, fingerprint {plan.hash.slice(0, 8)}
        </p>
        <h1 className="mt-1">Your launch plan</h1>
        <p className="mt-3 max-w-2xl text-lg">{review ? "Read it through, ask for changes in plain words, and approve when it looks right. Nothing is bought, published or spent before you approve." : `Approved ${state.mandate ? new Date(state.mandate.approvedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : ""}. This is the plan the agent is working from.`}</p>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </div>

      {lastChange && review && (
        <section className="mb-2 rounded-[14px] border-[1.5px] border-ink bg-marigold-soft p-4" aria-live="polite">
          <p className="font-bold">You asked: “{lastChange.text}”</p>
          <p className="mt-1">{lastChange.outcome}</p>
          {lastChange.diff && lastChange.diff.length > 0 && (
            <>
              <button className="link mt-2" onClick={() => setShowDiff(!showDiff)} aria-expanded={showDiff}>
                {showDiff ? "Hide" : "Show"} what changed between version {lastChange.fromVersion} and {lastChange.toVersion}
              </button>
              {showDiff && (
                <ul className="mt-3 space-y-2">
                  {lastChange.diff.map((d, i) => (
                    <li key={i} className="rounded-lg bg-white p-3">
                      <p className="text-sm font-bold">
                        {d.area}: {d.label}
                      </p>
                      <p className="mt-1 text-brick line-through decoration-1">{d.before || "(empty)"}</p>
                      <p className="text-leaf">{d.after || "(empty)"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      <Block title="The strategy" action={review && <AskChange area="strategy" onSend={send} busy={changing} placeholder="For example: focus on catering, not walk-ins" />}>
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4 text-lg">
            <p>{plan.strategy.summary}</p>
            <p>{plan.strategy.audience}</p>
            <p>{plan.strategy.whyTheseChannels}</p>
          </div>
          <div className="panel self-start">
            <h3>What success looks like</h3>
            <p className="display mt-3 text-3xl num">
              ${plan.strategy.success.costPerResultRange[0]} to ${plan.strategy.success.costPerResultRange[1]}
            </p>
            <p>per {goal.result}</p>
            <p className="display mt-4 text-3xl num">
              {plan.strategy.success.expectedResultsRange[0]} to {plan.strategy.success.expectedResultsRange[1]}
            </p>
            <p>{goal.results} over {b.months} month{b.months === 1 ? "" : "s"}</p>
            <p className="hint mt-3">{plan.strategy.success.caveat}</p>
          </div>
        </div>
      </Block>

      <Block title="Budget" action={review && <AskChange area="budget" onSend={send} busy={changing} placeholder="For example: put more on Google" />}>
        <div className="grid gap-8 md:grid-cols-2">
          <Receipt title="Where your budget goes">
            <Row label="Ads (80%)" value={fmtUsd(b.adSpend)} note={`About ${fmtUsd(b.dailyPacing)} a day for ${b.days} days`} />
            <Row label={`Google Search (${Math.round(b.platformSplit.google * 100)}%)`} value={fmtUsd(Math.floor(b.adSpend * b.platformSplit.google))} />
            <Row label={`Facebook and Instagram (${Math.round(b.platformSplit.meta * 100)}%)`} value={fmtUsd(b.adSpend - Math.floor(b.adSpend * b.platformSplit.google))} />
            <Row label="Agent running costs reserve (20%)" value={fmtUsd(b.opsReserve)} note="Pays for the AI model's work on your account. What is not used stays yours." />
            <Row label="Your budget" value={fmtUsd(b.total)} total />
          </Receipt>
          <Receipt title="Due when you approve">
            <Row label="Your budget" value={fmtUsd(b.total)} />
            <Row label={`Storefront, $20 a month × ${b.months}`} value={fmtUsd(b.subscriptionMonthly * b.months)} />
            {b.fees.map((f) => (
              <Row key={f.id} label={f.label} value={fmtUsd(f.amount)} />
            ))}
            <Row label="Total" value={fmtUsd(b.dueAtApproval)} total />
            <p className="hint mt-2">
              About {Math.round(b.explorationShare * 100)}% of ad money is kept for trying new ads and audiences. The first card charge from an ad platform will be around {fmtUsd(b.firstChargeEstimate, { cents: false })}.
            </p>
          </Receipt>
        </div>
      </Block>

      <Block title="The ads" action={review && <AskChange area="creative" onSend={send} busy={changing} placeholder="For example: less formal tone, or no ads on Mondays" />}>
        <div className="space-y-8">
          {plan.campaigns.map((c) => (
            <div key={c.id}>
              <h3 className="text-xl">{PLATFORM_LABEL[c.platform].replace("&", "and")}</h3>
              <p className="hint">
                {c.objective}. Sends people to {c.destination.replace(/^https?:\/\//, "")}. {c.locations}. {c.schedule}.
              </p>
              {c.adSets.map((s) => (
                <div key={s.id} className="mt-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">{s.name}</p>
                    <p className="hint num">starts at {fmtUsd(s.dailyBudget)} a day</p>
                  </div>
                  <p className="hint">{s.detail.join(". ")}.</p>
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-3">
                    {s.ads.map((ad) => {
                      const cr = plan.creatives.find((x) => x.id === ad.creativeId)!;
                      return <AdPreview key={ad.id} creative={cr} businessName={profile.basics.name} domain={plan.site?.chosenDomain} art={plan.site?.artDirection} photos={photos} badge={!cr.policy.ok ? <span className="tag tag-brick">Needs a fix</span> : undefined} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <p className="hint">Several versions run in each audience on purpose, so the agent can see which message works and move money to it.</p>
        </div>
      </Block>

      {plan.site && (
        <Block title="Your website" action={review && <AskChange area="site" onSend={send} busy={changing} placeholder="For example: a cleaner design, or use the second domain" />}>
          <div className="grid gap-8 md:grid-cols-[340px_1fr]">
            <div>
              <div className="overflow-hidden rounded-[28px] border-[6px] border-ink bg-white">
                <iframe key={plan.version} src={`/sites/${id}?v=${plan.version}`} title="Website preview" className="h-[600px] w-full" />
              </div>
              <a className="link mt-2 inline-block" href={`/sites/${id}?v=${plan.version}`} target="_blank" rel="noreferrer">
                Open the full preview
              </a>
            </div>
            <div>
              <p>
                Design: <strong>{ART[plan.site.artDirection]?.name}</strong>. {ART[plan.site.artDirection]?.blurb}
              </p>
              {plan.site.lint.notes.map((n) => (
                <p key={n} className="hint mt-1">{n}</p>
              ))}
              {plan.site.domainSuggestions.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="label">Domain name</legend>
                  <div className="space-y-2" role="radiogroup">
                    {plan.site.domainSuggestions.map((d) => {
                      const on = d.domain === plan.site!.chosenDomain;
                      return (
                        <button key={d.domain} role="radio" aria-checked={on} disabled={!review || changing} onClick={() => !on && send("domain", `use the domain ${d.domain}`)} className={`block w-full rounded-xl border-[1.5px] p-3 text-left ${on ? "border-blue bg-[#f3f6ff] shadow-[inset_0_0_0_1.5px_var(--blue)]" : "border-line bg-white"}`}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-bold break-all">{d.domain}</span>
                            <span className="num flex-none">{fmtUsd(d.price)} a year</span>
                          </span>
                          <span className="hint block">{[...d.reasons.slice(0, 2), ...d.flags].join(". ")}.</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint mt-2">Available when we checked. Registered in your name, at cost. We re-check the price before buying and stop if it changed.</p>
                </fieldset>
              )}
            </div>
          </div>
        </Block>
      )}

      {plan.listings && (
        <Block title="Your listings" action={review && <AskChange area="listing" onSend={send} busy={changing} placeholder="Say what looks wrong" />}>
          <div className="grid gap-6 md:grid-cols-2">
            {plan.listings.google && (
              <div className="panel">
                <p className="hint">Google Business Profile, {plan.listings.google.action === "claim" ? "claiming your existing listing" : "new listing"}</p>
                <h3 className="mt-1 text-xl">{plan.listings.google.name}</h3>
                <p>{plan.listings.google.category}</p>
                <p className="mt-2">{plan.listings.google.address}</p>
                <p>{plan.listings.google.phone}</p>
                {plan.listings.google.website && <p className="break-all text-blue">{plan.listings.google.website.replace(/^https?:\/\//, "")}</p>}
                <p className="mt-2">{plan.listings.google.description}</p>
                <details className="mt-2">
                  <summary className="link">Hours and services</summary>
                  <ul className="mt-2 text-sm">
                    {plan.listings.google.hours.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">{plan.listings.google.services.join(", ")}</p>
                </details>
              </div>
            )}
            {plan.listings.apple && (
              <div className="panel">
                <p className="hint">Apple Maps listing package</p>
                <h3 className="mt-1 text-xl">{plan.listings.apple.name}</h3>
                <p>{plan.listings.apple.address}</p>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {plan.listings.apple.checklist.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          <p className="hint mt-3">Name, address and phone are identical on the site, the listings and the ads.</p>
        </Block>
      )}

      <Block title="How much the agent can do without asking">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-5">
            {(
              [
                ["intraPlatformDailyShiftPct", "Move budget between audiences on one platform", "% a day", 0, 50],
                ["crossPlatformWeeklyShiftPct", "Move budget between Google and Facebook/Instagram", "% a week", 0, 40],
                ["maxPlatformSharePct", "Most it can put on one platform", "% of ad money", 50, 90],
              ] as const
            ).map(([key, label, unit, min, max]) => (
              <label key={key} className="block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">{label}</span>
                  <span className="num flex-none">
                    up to {plan.autonomy[key]}
                    {unit}
                  </span>
                </span>
                <input type="range" min={min} max={max} step={5} disabled={!review} value={plan.autonomy[key]} onChange={(e) => act("autonomy", { autonomy: { ...plan.autonomy, [key]: Number(e.target.value) } }, { quiet: true })} className="mt-1 w-full accent-[var(--blue)]" />
              </label>
            ))}
          </div>
          <div>
            <p className="font-bold">It always asks first before</p>
            <ul className="mt-1 list-disc pl-5">
              <li>spending more than {fmtUsd(b.adSpend, { cents: false })} on ads, or running past the end date</li>
              <li>adding a new platform</li>
              <li>advertising a new offer, discount or price</li>
              <li>making claims such as “best” or “guaranteed”</li>
            </ul>
            <p className="mt-3 font-bold">Tell me when</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {(
                [
                  ["budgetShift", "Budget moves"],
                  ["adPaused", "An ad is paused"],
                  ["newCreative", "A new ad starts"],
                  ["anomaly", "Something looks wrong"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className="chip" aria-pressed={plan.autonomy.notifyOn[k]} disabled={!review || k === "anomaly"} onClick={() => act("autonomy", { autonomy: { ...plan.autonomy, notifyOn: { ...plan.autonomy.notifyOn, [k]: !plan.autonomy.notifyOn[k] } } }, { quiet: true })}>
                  {l}
                </button>
              ))}
            </div>
            <p className="hint mt-2">Every action is listed under Activity with its reason, whether or not you are notified.</p>
          </div>
        </div>
      </Block>

      <Block title="Things only you can do">
        <ul className="space-y-3">
          {plan.ownerTasks.map((t) => (
            <li key={t.id}>
              <p className="font-bold">{t.title}</p>
              <p className="hint">{t.why}</p>
            </li>
          ))}
        </ul>
        {plan.notes.length > 0 && (
          <div className="mt-6 rounded-xl bg-sky p-4">
            <p className="font-bold">Worth knowing</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </Block>

      {review ? (
        <div className="sticky bottom-0 z-10 -mx-5 border-t-[1.5px] border-line bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
            <button
              className="link"
              onClick={async () => {
                if (await act("edit")) router.push(`/onboarding/${id}`);
              }}
            >
              Edit my answers
            </button>
            <span className="flex-1" />
            <button
              className="btn"
              disabled={busy === "approve"}
              onClick={async () => {
                if (await act("approve", { by: profile.contact.email || "the owner" })) router.push(`/b/${id}/launch`);
              }}
            >
              Approve version {plan.version}
            </button>
          </div>
        </div>
      ) : (
        state.status === "approved" && (
          <Link className="btn" href={`/b/${id}/launch`}>
            Continue to payment and launch
          </Link>
        )
      )}
    </div>
  );
}
