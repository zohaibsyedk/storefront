"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GOAL_LABEL, OPTIONAL_STEPS, STEP_IDS, STEP_SCHEMAS, STEP_TITLES, categoryById, completeness, type OnboardingDraft, type StepId } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { ErrorNote, Loading } from "@/components/ui";
import { BasicsStep, BudgetStep, ContactStep, CustomersStep, LocationStep, OfferingsStep, PhotosStep, ServicesStep, type StepProps } from "./steps";

const SCREENS: { id: StepId | "review"; title: string; lead: string }[] = [
  { id: "services", title: "What would you like us to set up?", lead: "Pick what you need. You can change this later." },
  { id: "basics", title: "Tell us about the business", lead: "The basics, in your own words." },
  { id: "offerings", title: "What do you sell, and for how much?", lead: "A few of your main products or services is enough to start." },
  { id: "location", title: "Where are you, and when are you open?", lead: "Used for your listing, your site and when your ads run." },
  { id: "contact", title: "How should customers reach you?", lead: "At least one way." },
  { id: "photos", title: "Add some photos", lead: "Optional, but they make the biggest difference." },
  { id: "customers", title: "Who are your customers?", lead: "Your best guess is fine." },
  { id: "budget", title: "Budget and timing", lead: "You approve the plan before anything is spent." },
  { id: "review", title: "Check it over", lead: "Edit anything, then we will draft your plan." },
];
const COMPONENTS: Record<StepId, (p: StepProps) => React.ReactNode> = { services: ServicesStep, basics: BasicsStep, offerings: OfferingsStep, location: LocationStep, contact: ContactStep, photos: PhotosStep, customers: CustomersStep, budget: BudgetStep };

function issuesFor(step: StepId, draft: OnboardingDraft): string[] {
  return completeness(draft).issues.find((i) => i.step === step)?.messages ?? [];
}

function summary(step: StepId, d: OnboardingDraft): string {
  switch (step) {
    case "services": {
      const s = d.services;
      if (!s) return "";
      return ["Ads", s.website && "Website", s.google && "Google Business Profile", s.apple && "Apple Maps"].filter(Boolean).join(", ");
    }
    case "basics":
      return d.basics?.name ? `${d.basics.name}${d.basics.category ? `, ${categoryById(d.basics.category).label.toLowerCase()}` : ""}` : "";
    case "offerings":
      return (d.offerings?.offerings ?? []).map((o) => o.name).filter(Boolean).slice(0, 4).join(", ");
    case "location":
      return [d.location?.address, d.location?.city].filter(Boolean).join(", ");
    case "contact":
      return [d.contact?.phone, d.contact?.email, d.contact?.bookingUrl].filter(Boolean).join(", ");
    case "photos":
      return d.photos?.photos?.length ? `${d.photos.photos.length} photo${d.photos.photos.length === 1 ? "" : "s"}` : "None yet";
    case "customers":
      return d.customers?.ageRanges?.length ? `Ages ${d.customers.ageRanges.join(", ")}; ${d.customers.reach === "local" ? `within ${d.customers.radiusMiles} miles` : d.customers.reach}` : "";
    case "budget":
      return d.budget?.totalUsd ? `$${d.budget.totalUsd.toLocaleString("en-US")} over ${d.budget.months} month${d.budget.months === 1 ? "" : "s"}${d.budget.goal ? `, for ${GOAL_LABEL[d.budget.goal].name.toLowerCase()}` : ""}` : "";
  }
}

export default function Onboarding() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { view, error, act, busy } = useBusiness(id);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (view && !draft) {
      if (view.state.status !== "onboarding") {
        router.replace(view.state.status === "review" ? `/b/${id}/plan` : `/b/${id}/dashboard`);
        return;
      }
      // One-time copy of the saved answers into the editable form state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(view.state.draft);
      setIndex(Math.min(SCREENS.length - 1, view.state.draft.lastStep ?? 0));
    }
  }, [view, draft, id, router]);

  if (error && !view) return <main className="p-6"><ErrorNote>{error}</ErrorNote></main>;
  if (!draft) return <Loading what="Opening your answers" />;

  const screen = SCREENS[index];
  const set: StepProps["set"] = (step, data) => {
    setDraft((d) => ({ ...d!, [step]: data }));
    setSaved("saving");
    clearTimeout(timers.current[step]);
    timers.current[step] = setTimeout(async () => {
      await act("saveStep", { step, data, lastStep: index }, { quiet: true });
      setSaved("saved");
    }, 450);
  };
  const go = (to: number) => {
    setDir(to > index ? 1 : -1);
    setIndex(to);
    void act("setStep", { lastStep: to }, { quiet: true });
    requestAnimationFrame(() => heading.current?.focus());
    window.scrollTo({ top: 0 });
  };
  const next = async () => {
    if (screen.id !== "review") {
      const step = screen.id;
      const data = draft[step];
      const optionalUntouched = OPTIONAL_STEPS.includes(step) && data === undefined;
      if (step === "services" && !draft.services?.confirmed) {
        // Keeping the defaults is a valid answer: confirm them when the owner presses Next.
        const s = { website: true, google: true, apple: false, hasWebsite: false, hasGoogleListing: false, hasAppleListing: false, ...(draft.services ?? {}), confirmed: true as const };
        setDraft((d) => ({ ...d!, services: s }));
        await act("saveStep", { step, data: s, lastStep: index + 1 }, { quiet: true });
        return go(index + 1);
      }
      if (!optionalUntouched && !STEP_SCHEMAS[step].safeParse(data ?? {}).success) {
        setTried((t) => ({ ...t, [step]: true }));
        return;
      }
      if (data !== undefined) {
        clearTimeout(timers.current[step]);
        await act("saveStep", { step, data, lastStep: index + 1 }, { quiet: true });
        setSaved("saved");
      }
    }
    go(index + 1);
  };
  const confirm = async () => {
    const res = await act("confirm");
    if (res) router.push(`/b/${id}/plan`);
  };
  const useExample = async () => {
    const res = await act("useExample");
    if (res) {
      setDraft(res.state.draft);
      go(SCREENS.length - 1);
    }
  };

  const comp = completeness(draft);
  const stepIssues = screen.id !== "review" && tried[screen.id] ? issuesFor(screen.id, draft) : [];
  const Body = screen.id !== "review" ? COMPONENTS[screen.id] : null;

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="awning" />
      <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-10 pt-9">
        <div className="flex items-center justify-between">
          <Link href="/" className="display text-lg text-blue">
            Storefront
          </Link>
          <span className="hint" aria-live="polite">
            {saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : ""}
          </span>
        </div>
        <div className="mt-4" role="progressbar" aria-valuemin={1} aria-valuemax={SCREENS.length} aria-valuenow={index + 1} aria-label={`Step ${index + 1} of ${SCREENS.length}`}>
          <div className="flex gap-1">
            {SCREENS.map((s, i) => (
              <span key={s.id} className={`h-2 flex-1 rounded-full ${i < index ? "bg-blue" : i === index ? "bg-marigold" : "bg-line"}`} />
            ))}
          </div>
          <p className="hint mt-2">
            Step {index + 1} of {SCREENS.length}
          </p>
        </div>

        <section key={screen.id} className="step-in mt-4" style={{ ["--from" as string]: `${dir * 24}px` }}>
          <h1 ref={heading} tabIndex={-1} className="text-[clamp(1.7rem,6vw,2.4rem)] outline-none">
            {screen.title}
          </h1>
          <p className="mt-2 text-muted">{screen.lead}</p>
          <div className="mt-6">
            {Body ? (
              <Body draft={draft} set={set} businessId={id} />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">
                      {comp.done} of {comp.total} sections complete
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-leaf" style={{ width: `${(comp.done / comp.total) * 100}%` }} />
                  </div>
                </div>
                <ul className="divide-y-[1.5px] divide-line rounded-[14px] bg-white">
                  {STEP_IDS.map((s, i) => {
                    const iss = issuesFor(s, draft);
                    return (
                      <li key={s} className="flex items-start justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block font-bold">{STEP_TITLES[s]}</span>
                          {iss.length ? <span className="block text-brick">{iss.join(". ")}</span> : <span className="hint block truncate">{summary(s, draft) || "Done"}</span>}
                        </span>
                        <button className="link flex-none" onClick={() => go(i)}>
                          {iss.length ? "Finish" : "Edit"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {comp.issues.length === 0 && <p>Next we draft your plan: the ads, the budget split{draft.services?.website ? ", a website preview with domain options" : ""}{draft.services?.google ? " and your Google profile" : ""}. Nothing is bought or published until you approve it.</p>}
              </div>
            )}
          </div>
          {stepIssues.length > 0 && (
            <div className="mt-4">
              <ErrorNote>{stepIssues.join(". ")}.</ErrorNote>
            </div>
          )}
          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {index === 0 && !draft.basics?.name && (
            <p className="hint mt-6">
              Just looking?{" "}
              <button className="link" onClick={useExample}>
                Fill in an example bakery
              </button>{" "}
              and skip to the review.
            </p>
          )}
        </section>
      </div>

      <nav className="sticky bottom-0 z-10 border-t-[1.5px] border-line bg-white" aria-label="Wizard">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3">
          {index > 0 && (
            <button className="btn btn-quiet" onClick={() => go(index - 1)}>
              Back
            </button>
          )}
          <span className="flex-1" />
          {screen.id !== "review" && OPTIONAL_STEPS.includes(screen.id) && !draft[screen.id] && (
            <button className="link" onClick={() => go(index + 1)}>
              Skip for now
            </button>
          )}
          {screen.id === "review" ? (
            <button className="btn" onClick={confirm} disabled={busy === "confirm" || comp.issues.length > 0} title={comp.issues.length ? "Finish the sections marked above first" : undefined}>
              {busy === "confirm" ? "Drafting your plan" : comp.issues.length ? `${comp.issues.length} section${comp.issues.length === 1 ? "" : "s"} to finish` : "Draft my plan"}
            </button>
          ) : (
            <button className="btn" onClick={next}>
              Next
            </button>
          )}
        </div>
      </nav>
    </main>
  );
}
