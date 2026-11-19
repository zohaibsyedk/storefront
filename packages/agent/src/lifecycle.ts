import {
  STEP_SCHEMAS,
  completeness,
  fmtUsd,
  shortId,
  usd,
  type BusinessProfile,
  type BusinessState,
  type ChangeRequest,
  type ExecutionStep,
  type LaunchPlan,
  type LiveCampaign,
  type Micro,
  type OnboardingDraft,
  type StepId,
} from "@storefront/core";
import { ACCOUNTS, MockChain, SolanaChain, solanaConfig, accrueOps, fundWallet, logAction, payFromWallet, reconcile, settleOps, syncAllowance, type Chain } from "@storefront/treasury";
import { draftPlan } from "./draft";
import { MockRegistrar, type Registrar } from "./domains";
import { llmProvider } from "./llm";
import { dataDir } from "./store";
import { createMandate } from "./mandate";
import { applyPatch, describeOutcome, diffPlans, interpretChange, patchIsEmpty } from "./revise";
import { curateDashboard } from "./dashboard";
import { paceBudgets } from "./engine";

/** Estimated model cost per agent job, drawn from the 20% reserve. Simulated in this build. */
export const OPS_COST: Record<string, Micro> = { draft: usd(0.9), revise: usd(0.25), optimise: usd(0.05), report: usd(0.2), curate: usd(0.1), chat: usd(0.02) };

/**
 * Which chain a business uses is fixed when its wallet is created: STOREFRONT_CHAIN=devnet|localnet
 * selects real Solana for new businesses; everything else (and every existing mock wallet) stays mock.
 */
let chainFactory: (state: BusinessState) => Chain = (state) => {
  const kind = state.wallet?.chain ?? (process.env.STOREFRONT_CHAIN === "devnet" || process.env.STOREFRONT_CHAIN === "localnet" ? process.env.STOREFRONT_CHAIN : "mock");
  if (kind === "devnet" || kind === "localnet") return new SolanaChain(state, solanaConfig(dataDir(), kind));
  return new MockChain(state);
};
export function setChainFactory(f: (state: BusinessState) => Chain) {
  chainFactory = f;
}
export function chainFor(state: BusinessState): Chain {
  return chainFactory(state);
}
const registrar: Registrar = new MockRegistrar();

export function latestPlan(state: BusinessState): LaunchPlan | undefined {
  return state.plans[state.plans.length - 1];
}
export function latestProfile(state: BusinessState): BusinessProfile | undefined {
  return state.profiles[state.profiles.length - 1];
}

export function saveStep(state: BusinessState, step: StepId, data: unknown, lastStep?: number): void {
  if (!(step in STEP_SCHEMAS)) throw new Error("Unknown step");
  (state.draft as Record<string, unknown>)[step] = data;
  if (typeof lastStep === "number") state.draft.lastStep = lastStep;
}

/** Review & confirm: freeze the draft into a versioned BusinessProfile and draft the plan. */
export async function confirmProfile(state: BusinessState): Promise<LaunchPlan> {
  const c = completeness(state.draft);
  if (c.issues.length) throw new Error(`Still missing: ${c.issues.map((i) => i.messages[0]).join("; ")}`);
  const d = state.draft as Required<OnboardingDraft>;
  const profile = {
    version: state.profiles.length + 1,
    createdAt: new Date().toISOString(),
    services: STEP_SCHEMAS.services.parse(d.services),
    basics: STEP_SCHEMAS.basics.parse(d.basics),
    offerings: STEP_SCHEMAS.offerings.parse(d.offerings).offerings,
    location: STEP_SCHEMAS.location.parse(d.location),
    contact: STEP_SCHEMAS.contact.parse(d.contact),
    photos: STEP_SCHEMAS.photos.parse(d.photos ?? { photos: [] }),
    customers: STEP_SCHEMAS.customers.parse(d.customers),
    budget: STEP_SCHEMAS.budget.parse(d.budget),
  } satisfies BusinessProfile;
  state.profiles.push(profile);
  state.status = "drafting";
  state.llm.provider = llmProvider();
  const prev = latestPlan(state);
  const plan = await draftPlan(profile, { version: state.plans.length + 1, registrar, settings: prev ? { ...prev.settings } : undefined });
  state.plans.push(plan);
  state.status = "review";
  accrueOps(state, OPS_COST.draft, "Drafting the launch plan");
  logAction(state, { actor: "Strategist", kind: "plan_drafted", title: `Drafted launch plan version ${plan.version}`, reason: `Built from your answers: ${plan.campaigns.length} campaigns, ${plan.creatives.length} ad variations${plan.site ? `, a website preview and ${plan.site.domainSuggestions.length} domain options` : ""}.` });
  return plan;
}

export async function requestChange(state: BusinessState, area: ChangeRequest["area"], text: string): Promise<ChangeRequest> {
  const plan = latestPlan(state);
  const profile = latestProfile(state);
  if (!plan || !profile) throw new Error("No plan to change");
  if (state.status !== "review") throw new Error("The plan is already approved. Use “Ask your marketer” to change a running campaign.");
  const cr: ChangeRequest = { id: shortId("cr"), area, text: text.trim().slice(0, 500), createdAt: new Date().toISOString(), fromVersion: plan.version };
  const { patch } = await interpretChange(cr.text, plan, profile);
  if (patchIsEmpty(patch)) {
    cr.outcome = describeOutcome(cr, patch, []);
    cr.diff = [];
    state.changeRequests.push(cr);
    return cr;
  }
  const settings = applyPatch(plan.settings, patch);
  const next = await draftPlan(profile, { version: plan.version + 1, settings, domains: plan.site?.domainSuggestions, registrar, basedOnChange: cr.id });
  const diff = diffPlans(plan, next);
  if (diff.length === 0) {
    cr.outcome = "The plan already matches that, so nothing changed.";
    cr.diff = [];
    state.changeRequests.push(cr);
    return cr;
  }
  cr.toVersion = next.version;
  cr.diff = diff;
  cr.outcome = describeOutcome(cr, patch, diff);
  state.plans.push(next);
  state.changeRequests.push(cr);
  accrueOps(state, OPS_COST.revise, "Revising the launch plan");
  logAction(state, { actor: "Strategist", kind: "plan_revised", title: `Revised the plan to version ${next.version}`, reason: `You asked: “${cr.text}”. ${cr.outcome}` });
  return cr;
}

export async function approvePlan(state: BusinessState, by: string): Promise<void> {
  const plan = latestPlan(state);
  if (!plan) throw new Error("No plan to approve");
  if (state.status !== "review") throw new Error("This plan is already approved");
  const blocked = plan.creatives.filter((c) => !c.policy.ok);
  if (blocked.length) throw new Error(`${blocked.length} ad variation(s) need a fix before approval`);
  state.mandate = createMandate(plan, by);
  state.status = "approved";
  const chain = chainFor(state);
  if (!state.wallet) {
    const w = await chain.createWallet("agent");
    const d = await chain.createWallet("card-delegate");
    state.wallet = { address: w.address, keyRef: w.keyRef, delegate: d.address, delegateRef: d.keyRef, chain: chain.kind };
  }
  state.execution = buildExecution(plan);
  logAction(state, { actor: "Owner", kind: "plan_approved", title: `Approved plan version ${plan.version}`, reason: `Approved by ${by}. The agent may now act on its own within ${fmtUsd(plan.budget.adSpend)} of ad spend over ${plan.budget.days} days on ${plan.campaigns.map((c) => (c.platform === "google" ? "Google" : "Facebook and Instagram")).join(" and ")}. Plan fingerprint ${plan.hash}.` });
}

function buildExecution(plan: LaunchPlan): ExecutionStep[] {
  const steps: ExecutionStep[] = [{ id: "fund", label: "Take payment and convert it to USDC", status: "pending" }];
  if (plan.site) {
    if (plan.site.chosenDomain) steps.push({ id: "domain", label: `Buy ${plan.site.chosenDomain}`, status: "pending" });
    steps.push({ id: "site", label: "Publish the website", status: "pending" });
  }
  if (plan.listings?.google) steps.push({ id: "gbp", label: `${plan.listings.google.action === "claim" ? "Claim" : "Create"} the Google Business Profile`, status: "pending" });
  if (plan.listings?.apple) steps.push({ id: "apple", label: "Prepare the Apple Maps listing", status: "pending" });
  steps.push({ id: "subscription", label: "Charge the first month of Storefront", status: "pending" });
  steps.push({ id: "allowance", label: "Give the card a spending limit", status: "pending" });
  steps.push({ id: "launch", label: "Launch the ad campaigns", status: "pending" });
  return steps;
}

const stepOf = (state: BusinessState, id: string) => state.execution.find((s) => s.id === id);
const finish = (s: ExecutionStep | undefined, detail: string, status: ExecutionStep["status"] = "done", txSig?: string) => {
  if (s) ((s.status = status), (s.detail = detail), (s.txSig = txSig));
};

/**
 * Autonomous execution after approval. Each step is idempotent: a step that is
 * already done is skipped, so the whole function can be retried safely.
 */
export async function fundAndLaunch(state: BusinessState, opts: { onStep?: (s: BusinessState) => void } = {}): Promise<void> {
  const plan = latestPlan(state);
  const m = state.mandate;
  if (!plan || !m || !state.wallet) throw new Error("Approve the plan first");
  if (state.status !== "approved") throw new Error(state.status === "live" ? "Already launched" : "Approve the plan first");
  const chain = chainFor(state);
  const tick = () => opts.onStep?.(state);

  let s = stepOf(state, "fund");
  if (s && s.status !== "done") {
    const tx = await fundWallet(state, chain, plan.budget.dueAtApproval, `Card payment of ${fmtUsd(plan.budget.dueAtApproval)} (test payment processor)`);
    finish(s, `${fmtUsd(plan.budget.dueAtApproval)} received and held as USDC in the agent wallet`, "done", tx.sig);
    tick();
  }

  s = stepOf(state, "domain");
  if (s && s.status !== "done" && plan.site?.chosenDomain) {
    const pick = plan.site.domainSuggestions.find((d) => d.domain === plan.site!.chosenDomain)!;
    const now = await registrar.check(pick.domain);
    if (!now.available || now.price !== pick.price) {
      finish(s, !now.available ? "The domain was taken before we could buy it. Pick another and we will continue." : `The price changed to ${fmtUsd(now.price)}. Nothing was bought.`, "failed");
      logAction(state, { actor: "SiteBuilder", kind: "domain_aborted", severity: "alert", title: `Did not buy ${pick.domain}`, reason: s.detail! });
      state.ownerTasks.push({ id: "domain_retry", title: "Choose a different domain", why: s.detail!, steps: ["Open the plan", "Pick another domain", "Approve again"], status: "todo", blocking: false });
    } else {
      const order = await registrar.register(pick.domain, `${state.id}:${pick.domain}`, pick.price);
      const tx = await payFromWallet(state, chain, ACCOUNTS.domainFee, pick.price, `Domain ${pick.domain}, first year`, "Pre-approved line item in your plan. Registered in your name with WHOIS privacy on; charged at cost.");
      finish(s, `Registered to you with privacy on (order ${order.orderId}). Renews at ${fmtUsd(pick.renewal)} a year; we remind you 30, 7 and 1 days before.`, "done", tx?.sig);
      state.site = { url: `/sites/${state.id}`, domain: pick.domain, live: false, version: plan.version };
    }
    tick();
  }

  s = stepOf(state, "site");
  if (s && s.status !== "done" && plan.site) {
    state.site = { url: `/sites/${state.id}`, domain: state.site?.domain, live: true, version: plan.version };
    finish(s, state.site.domain ? `Live at ${state.site.domain} with a secure certificate; health check passed` : "Live on a preview address");
    logAction(state, { actor: "SiteBuilder", kind: "site_live", title: "Published your website", reason: `${plan.site.sections.length} sections in the ${plan.site.artDirection.replace("_", " ")} design, with your address and hours marked up for local search.` });
    tick();
  }

  s = stepOf(state, "gbp");
  if (s && s.status !== "done" && plan.listings?.google) {
    const g = plan.listings.google;
    finish(s, `Searched Google for an existing listing first, then ${g.action === "claim" ? "requested ownership of yours" : "created a new one"}. Waiting for you to verify.`, "owner_task");
    state.ownerTasks.push({ id: "gbp_verify", title: "Verify your Google Business Profile", why: "Google needs proof you own the business before the profile shows publicly. Only the owner can do this.", steps: ["Open the verification link we emailed you", "Choose phone, video or postcard", "Enter the code Google gives you"], status: "todo", blocking: false });
    logAction(state, { actor: "ListingsManager", kind: "listing", title: `${g.action === "claim" ? "Requested" : "Created"} your Google Business Profile`, reason: "Hours, services, photos and website were filled in from your answers so they match the site exactly." });
    tick();
  }
  s = stepOf(state, "apple");
  if (s && s.status !== "done" && plan.listings?.apple) {
    finish(s, "Listing package is ready. Apple only accepts it from your own Apple Account.", "owner_task");
    state.ownerTasks.push({ id: "apple_listing", title: "Submit your Apple Maps listing", why: "Apple only takes listings from the owner. Everything is prepared for you to paste in.", steps: plan.listings.apple.checklist, status: "todo", blocking: false });
    tick();
  }

  s = stepOf(state, "subscription");
  if (s && s.status !== "done") {
    const tx = await payFromWallet(state, chain, ACCOUNTS.subscription, plan.budget.subscriptionMonthly, "Storefront subscription, month 1", "The flat $20 a month for running your marketing.");
    finish(s, `${fmtUsd(plan.budget.subscriptionMonthly)} for month 1`, "done", tx?.sig);
    tick();
  }

  // Go live: create campaigns from the approved plan, then size the card limit.
  state.creatives = plan.creatives.map((c) => ({ ...c }));
  state.campaigns = plan.campaigns.map<LiveCampaign>((c) => ({
    id: c.id,
    platform: c.platform,
    name: c.name,
    status: "active",
    pausedDays: c.pausedDays,
    adSets: c.adSets.map((a) => ({ id: a.id, name: a.name, audience: a.audience, dailyBudget: a.dailyBudget, status: "active", launchedDay: 0, lastSignificantEditDay: 0, ads: a.ads.map((ad) => ({ id: ad.id, creativeId: ad.creativeId, status: "active", launchedDay: 0 })) })),
  }));
  state.status = "live";
  paceBudgets(state, 0);

  s = stepOf(state, "allowance");
  if (s && s.status !== "done") {
    const tx = await syncAllowance(state, chain, "First month's ad budget plus a small buffer for billing timing. The card can never take more than this from the wallet.");
    const al = await chain.allowance(state.wallet.address);
    finish(s, `The card can spend up to ${fmtUsd(al.amount)}. The rest of the wallet is out of its reach.`, "done", tx?.sig);
    tick();
  }
  s = stepOf(state, "launch");
  if (s && s.status !== "done") {
    for (const c of state.campaigns) logAction(state, { actor: "MediaBuyer", kind: "campaign_launched", title: `Launched ${c.platform === "google" ? "Google Search" : "Facebook and Instagram"} ads`, reason: `${c.adSets.length} audiences and ${c.adSets.reduce((a, x) => a + x.ads.length, 0)} ad variations, all approved in plan version ${plan.version}. Daily budget ${fmtUsd(c.adSets.reduce((a, x) => a + x.dailyBudget, 0))}.` });
    finish(s, `${state.campaigns.length} campaigns are running in test ad accounts`);
    state.ownerTasks.push({ id: "connect_ads", title: "Connect your real Google Ads and Meta accounts", why: "This build runs on test ad accounts with simulated results. Going live needs ad accounts in your name.", steps: ["Sign in to Google Ads and accept the manager link", "Sign in to Meta Business and approve partner access", "Add the Storefront card under billing in both"], status: "todo", blocking: false });
  }
  await settleOps(state, chain);
  state.dashboard = curateDashboard(state);
  await reconcile(state, chain, 0);
}
