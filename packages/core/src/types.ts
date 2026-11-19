import { z } from "zod";
import type { Micro } from "./money";

export type Platform = "google" | "meta";
export const PLATFORMS: Platform[] = ["google", "meta"];
export const PLATFORM_LABEL: Record<Platform, string> = { google: "Google Search", meta: "Facebook & Instagram" };

export const GOALS = ["calls", "bookings", "foot_traffic", "online_orders", "leads"] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABEL: Record<Goal, { name: string; result: string; results: string }> = {
  calls: { name: "Phone calls", result: "call", results: "calls" },
  bookings: { name: "Bookings", result: "booking", results: "bookings" },
  foot_traffic: { name: "Visits to the shop", result: "visit request", results: "visit requests" },
  online_orders: { name: "Online orders", result: "order", results: "orders" },
  leads: { name: "Enquiries", result: "enquiry", results: "enquiries" },
};

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/* ---------- Onboarding wizard: one schema per step, reused by the agent ---------- */

export const servicesStep = z.object({
  website: z.boolean(),
  google: z.boolean(),
  apple: z.boolean(),
  hasWebsite: z.boolean(),
  existingUrl: z.string().optional(),
  hasGoogleListing: z.boolean(),
  hasAppleListing: z.boolean(),
  /** The owner must actively confirm this screen, even if they keep every toggle off. */
  confirmed: z.literal(true, { message: "Choose what you want us to set up" }),
});

export const basicsStep = z.object({
  name: z.string().trim().min(2, "Add your business name"),
  category: z.string().min(1, "Pick the closest category"),
  description: z.string().trim().min(12, "Describe the business in a sentence"),
});

export const offeringSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, "Name this item"),
    description: z.string().optional(),
    priceType: z.enum(["fixed", "from", "range", "quote"]),
    price: z.number().nonnegative().optional(),
    priceMax: z.number().nonnegative().optional(),
    duration: z.string().optional(),
  })
  .refine((o) => o.priceType === "quote" || typeof o.price === "number", { message: "Add a price, or choose “call for quote”" })
  .refine((o) => o.priceType !== "range" || (typeof o.priceMax === "number" && o.priceMax >= (o.price ?? 0)), { message: "Add the top of the price range" });
export type Offering = z.infer<typeof offeringSchema>;

export const offeringsStep = z.object({
  offerings: z.array(offeringSchema).min(1, "Add at least one product or service"),
});

const hoursDay = z.object({ closed: z.boolean(), open: z.string(), close: z.string() });
export const locationStep = z
  .object({
    mode: z.enum(["storefront", "service_area"]),
    address: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postal: z.string().optional(),
    hideAddress: z.boolean(),
    radiusMiles: z.number().min(1).max(100),
    areas: z.array(z.string()),
    hours: z.record(z.enum(DAYS), hoursDay),
  })
  .refine((l) => l.mode !== "storefront" || (!!l.address?.trim() && !!l.city?.trim()), { message: "Add your street address and city" })
  .refine((l) => l.mode !== "service_area" || !!l.city?.trim() || l.areas.length > 0, { message: "Add the city or areas you serve" });

export const contactStep = z
  .object({
    phone: z.string().optional(),
    email: z.string().optional(),
    bookingUrl: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
  })
  .refine((c) => !!c.phone?.trim() || !!c.email?.trim() || !!c.bookingUrl?.trim(), { message: "Add at least one way for customers to reach you" });

export const PHOTO_TAGS = ["storefront", "interior", "team", "product", "work_sample"] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];
export const photoSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  tag: z.enum(PHOTO_TAGS),
  width: z.number(),
  height: z.number(),
  warning: z.string().optional(),
});
export type Photo = z.infer<typeof photoSchema>;
export const photosStep = z.object({
  photos: z.array(photoSchema),
  logo: photoSchema.optional(),
  noLogo: z.boolean().optional(),
});

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const REACH = ["local", "city", "regional", "national"] as const;
export const customersStep = z.object({
  ageRanges: z.array(z.enum(AGE_RANGES)).min(1, "Pick at least one age range"),
  gender: z.enum(["any", "mostly_women", "mostly_men"]),
  reach: z.enum(REACH),
  radiusMiles: z.number().min(1).max(100),
  languages: z.array(z.string()),
  interests: z.array(z.string()),
  bestCustomer: z.string().optional(),
});

export const budgetStep = z.object({
  totalUsd: z.number().min(100, "The smallest budget we can run well is $100"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  months: z.union([z.literal(1), z.literal(3), z.literal(6)]),
  renew: z.boolean(),
  goal: z.enum(GOALS),
});

export const STEP_IDS = ["services", "basics", "offerings", "location", "contact", "photos", "customers", "budget"] as const;
export type StepId = (typeof STEP_IDS)[number];
export const STEP_SCHEMAS = {
  services: servicesStep,
  basics: basicsStep,
  offerings: offeringsStep,
  location: locationStep,
  contact: contactStep,
  photos: photosStep,
  customers: customersStep,
  budget: budgetStep,
} as const;
export const STEP_TITLES: Record<StepId, string> = {
  services: "What you need",
  basics: "Business basics",
  offerings: "Products and prices",
  location: "Location and hours",
  contact: "Contact details",
  photos: "Photos",
  customers: "Your customers",
  budget: "Budget and time frame",
};
export const OPTIONAL_STEPS: StepId[] = ["photos"];

export interface BusinessProfile {
  version: number;
  createdAt: string;
  services: z.infer<typeof servicesStep>;
  basics: z.infer<typeof basicsStep>;
  offerings: Offering[];
  location: z.infer<typeof locationStep>;
  contact: z.infer<typeof contactStep>;
  photos: z.infer<typeof photosStep>;
  customers: z.infer<typeof customersStep>;
  budget: z.infer<typeof budgetStep>;
}
export type OnboardingDraft = { [K in StepId]?: Partial<z.infer<(typeof STEP_SCHEMAS)[K]>> } & { lastStep?: number };

export interface StepIssue {
  step: StepId;
  messages: string[];
}

/** What is still missing, per step. Empty list = ready to draft. */
export function completeness(draft: OnboardingDraft): { issues: StepIssue[]; done: number; total: number } {
  const issues: StepIssue[] = [];
  let done = 0;
  for (const step of STEP_IDS) {
    const res = STEP_SCHEMAS[step].safeParse(draft[step] ?? {});
    if (res.success) done++;
    else if (OPTIONAL_STEPS.includes(step) && draft[step] === undefined) done++;
    else {
      const messages = Array.from(new Set(res.error.issues.map((i) => friendlyIssue(step, i.path.join("."), i.message))));
      issues.push({ step, messages });
    }
  }
  return { issues, done, total: STEP_IDS.length };
}

function friendlyIssue(step: StepId, path: string, message: string): string {
  if (!/^Invalid|expected|Required/i.test(message)) return message;
  const map: Record<string, string> = {
    "services.confirmed": "Choose what you want us to set up",
    "basics.name": "Add your business name",
    "basics.category": "Pick the closest category",
    "basics.description": "Describe the business in a sentence",
    "offerings.offerings": "Add at least one product or service",
    "customers.ageRanges": "Pick at least one age range",
    "customers.reach": "Say where your customers come from",
    "budget.totalUsd": "Enter your marketing budget",
    "budget.startDate": "Pick a start date",
    "budget.months": "Choose how long to run",
    "budget.goal": "Choose your main goal",
  };
  return map[`${step}.${path}`] ?? `Finish the “${STEP_TITLES[step]}” step`;
}

/* ---------- Creative ---------- */

export const HOOKS = ["question", "offer_led", "local_pride", "craft_story", "urgency"] as const;
export const OFFERS = ["signature_item", "first_visit", "bundle", "none"] as const;
export const VISUALS = ["product_closeup", "storefront", "people_at_work", "type_only"] as const;
export const ANGLES = ["quality", "convenience", "price", "local"] as const;
export interface CreativeAttributes {
  hook: (typeof HOOKS)[number];
  offer: (typeof OFFERS)[number];
  visual: (typeof VISUALS)[number];
  angle: (typeof ANGLES)[number];
}
export const ATTRIBUTE_LABEL: Record<string, string> = {
  question: "Opens with a question",
  offer_led: "Leads with the offer",
  local_pride: "Neighbourhood pride",
  craft_story: "How it's made",
  urgency: "Limited time",
  signature_item: "Signature item",
  first_visit: "First-visit welcome",
  bundle: "Bundle",
  none: "No offer",
  product_closeup: "Product close-up",
  storefront: "Shop front",
  people_at_work: "People at work",
  type_only: "Words only",
  quality: "Quality",
  convenience: "Convenience",
  price: "Value",
  local: "Local",
};

export interface Creative {
  id: string;
  platform: Platform;
  format: "search_text" | "feed_4x5" | "story_9x16" | "square_1x1";
  headline: string;
  body: string;
  cta: string;
  attributes: CreativeAttributes;
  photoId?: string;
  generation: number;
  parentId?: string;
  createdDay: number;
  policy: { ok: boolean; notes: string[] };
}

/* ---------- Launch plan ---------- */

export interface PlanAd {
  id: string;
  creativeId: string;
}
export interface PlanAdSet {
  id: string;
  name: string;
  audience: string;
  detail: string[];
  dailyBudget: Micro;
  ads: PlanAd[];
}
export interface PlanCampaign {
  id: string;
  platform: Platform;
  name: string;
  objective: string;
  destination: string;
  locations: string;
  schedule: string;
  /** Days of the week ads do not run. */
  pausedDays: Day[];
  adSets: PlanAdSet[];
}

export interface BudgetPeriod {
  index: number;
  startDay: number;
  endDay: number; // exclusive
  adCap: Micro;
}

export interface PlanBudget {
  total: Micro;
  adSpend: Micro;
  opsReserve: Micro;
  subscriptionMonthly: Micro;
  months: number;
  days: number;
  platformSplit: Record<Platform, number>;
  explorationShare: number;
  periods: BudgetPeriod[];
  dailyPacing: Micro;
  firstChargeEstimate: Micro;
  fees: { id: string; label: string; amount: Micro }[];
  dueAtApproval: Micro;
}

export interface DomainSuggestion {
  domain: string;
  price: Micro;
  renewal: Micro;
  score: number;
  reasons: string[];
  flags: string[];
}

export type SectionType =
  | "hero"
  | "intro"
  | "menu"
  | "gallery"
  | "story"
  | "hours_map"
  | "cta_band"
  | "faq"
  | "contact"
  | "footer";
export interface SiteSection {
  id: string;
  type: SectionType;
  props: Record<string, unknown>;
}
export interface SiteDraft {
  artDirection: string;
  tone: "warm" | "plain" | "formal";
  title: string;
  metaDescription: string;
  sections: SiteSection[];
  domainSuggestions: DomainSuggestion[];
  chosenDomain: string;
  lint: { ok: boolean; notes: string[] };
}

export interface ListingDraft {
  google?: {
    action: "create" | "claim";
    name: string;
    category: string;
    description: string;
    address: string;
    phone: string;
    website: string;
    hours: string[];
    services: string[];
    photoIds: string[];
  };
  apple?: {
    action: "create" | "claim";
    name: string;
    category: string;
    address: string;
    phone: string;
    checklist: string[];
  };
  napConsistent: boolean;
}

export interface Autonomy {
  intraPlatformDailyShiftPct: number;
  crossPlatformWeeklyShiftPct: number;
  maxPlatformSharePct: number;
  notifyOn: { budgetShift: boolean; adPaused: boolean; newCreative: boolean; anomaly: boolean };
}

export interface PlanSettings {
  tone: "warm" | "plain" | "formal";
  emphasis?: string;
  chosenDomain?: string;
  pausedDays: Day[];
  platformSplit?: Record<Platform, number>;
  artDirection?: string;
  autonomy?: Autonomy;
}

export interface LaunchPlan {
  settings: PlanSettings;
  version: number;
  createdAt: string;
  hash: string;
  profileVersion: number;
  basedOnChange?: string;
  strategy: {
    summary: string;
    audience: string;
    whyTheseChannels: string;
    success: { metricLabel: string; costPerResultRange: [number, number]; expectedResultsRange: [number, number]; caveat: string };
    emphasis?: string;
  };
  budget: PlanBudget;
  campaigns: PlanCampaign[];
  creatives: Creative[];
  site?: SiteDraft;
  listings?: ListingDraft;
  autonomy: Autonomy;
  ownerTasks: { id: string; title: string; why: string }[];
  notes: string[];
}

export interface PlanDiffItem {
  area: string;
  label: string;
  before: string;
  after: string;
}

export interface ChangeRequest {
  id: string;
  area: "strategy" | "budget" | "campaigns" | "creative" | "site" | "domain" | "listing" | "autonomy";
  text: string;
  createdAt: string;
  fromVersion: number;
  toVersion?: number;
  outcome?: string;
  diff?: PlanDiffItem[];
}

/* ---------- Mandate ---------- */

export interface Mandate {
  id: string;
  planVersion: number;
  planHash: string;
  approvedAt: string;
  approvedBy: string;
  totalAdBudget: Micro;
  opsReserve: Micro;
  days: number;
  periods: BudgetPeriod[];
  allowedPlatforms: Platform[];
  bounds: Autonomy;
  /** Allowance may exceed the period's remaining cap by at most this much, to absorb billing timing. */
  allowanceBuffer: Micro;
  /** Worst-case daily overdelivery multiplier the platforms may apply. */
  overdelivery: number;
  approvedOffers: string[];
  status: "active" | "stopped" | "completed";
}

/* ---------- Live ad entities ---------- */

export interface LiveAd {
  id: string;
  creativeId: string;
  status: "active" | "paused";
  pausedReason?: string;
  launchedDay: number;
}
export interface LiveAdSet {
  id: string;
  name: string;
  audience: string;
  dailyBudget: Micro;
  status: "active" | "paused";
  launchedDay: number;
  lastSignificantEditDay: number;
  ads: LiveAd[];
}
export interface LiveCampaign {
  id: string;
  platform: Platform;
  name: string;
  status: "active" | "paused" | "ended";
  pausedDays: Day[];
  adSets: LiveAdSet[];
}

export interface MetricFact {
  day: number;
  platform: Platform;
  campaignId: string;
  adSetId: string;
  adId: string;
  creativeId: string;
  impressions: number;
  clicks: number;
  results: number;
  spend: Micro;
}

/* ---------- Money ---------- */

export interface LedgerLine {
  account: string;
  /** Positive = debit, negative = credit. Lines of one entry sum to zero. */
  amount: Micro;
}
export interface LedgerEntry {
  id: string;
  day: number;
  at: string;
  kind: string;
  memo: string;
  lines: LedgerLine[];
  txSig?: string;
  ref?: string;
}

export interface ChainTx {
  sig: string;
  kind: "mint" | "transfer" | "approve" | "revoke" | "delegated_transfer";
  from?: string;
  to?: string;
  amount: Micro;
  memo: string;
  day: number;
  at: string;
  explorer?: string;
}

export interface CardTxn {
  id: string;
  day: number;
  platform: Platform;
  amount: Micro;
  status: "settled" | "declined";
  reason: string;
  txSig?: string;
}

export interface Reconciliation {
  day: number;
  at: string;
  ok: boolean;
  checks: { label: string; a: Micro; b: Micro; ok: boolean; detail: string }[];
}

/* ---------- Agent output ---------- */

export interface AgentAction {
  id: string;
  day: number;
  at: string;
  actor: "Strategist" | "MediaBuyer" | "Treasurer" | "CreativeProducer" | "SiteBuilder" | "ListingsManager" | "Optimizer" | "Owner" | "Analyst";
  kind: string;
  title: string;
  reason: string;
  amount?: Micro;
  txSig?: string;
  severity?: "info" | "notice" | "alert";
}

export interface DecisionLogEntry {
  id: string;
  day: number;
  scope: string;
  inputs: Record<string, number | string>;
  estimates: { label: string; costPerResult: number | null; pBest: number; spend: number; results: number }[];
  alternatives: string[];
  action: string;
  expected: string;
  outcome?: { day: number; text: string; better: boolean | null };
}

export type WidgetType =
  | "pacing"
  | "kpi"
  | "wallet"
  | "actions"
  | "timeseries"
  | "platform_compare"
  | "creative_leaderboard"
  | "funnel"
  | "weekday"
  | "attribute_wins"
  | "what_changed"
  | "insight";
export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  core: boolean;
  why?: string;
  config?: Record<string, unknown>;
}
export interface InsightCitation {
  label: string;
  metric: "spend" | "results" | "clicks" | "impressions" | "cpr" | "ctr";
  scope: { platform?: Platform; creativeId?: string; fromDay: number; toDay: number };
  value: number;
}
export interface Insight {
  id: string;
  day: number;
  text: string;
  citations: InsightCitation[];
  validated: boolean;
}
export interface DashboardSpec {
  version: number;
  curatedDay: number;
  stage: "learning" | "optimizing";
  widgets: Widget[];
  insights: Insight[];
}

export interface OwnerTask {
  id: string;
  title: string;
  why: string;
  steps: string[];
  status: "todo" | "done";
  blocking: boolean;
}

export interface ChatMessage {
  id: string;
  role: "owner" | "agent";
  text: string;
  at: string;
  applied?: string;
}

export interface WeeklyReport {
  id: string;
  week: number;
  day: number;
  headline: string;
  happened: string[];
  changed: string[];
  next: string[];
  spent: Micro;
  results: number;
}

export interface ExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "owner_task" | "failed";
  detail?: string;
  txSig?: string;
}

export interface BusinessState {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "onboarding" | "drafting" | "review" | "approved" | "live" | "stopped" | "completed";
  draft: OnboardingDraft;
  profiles: BusinessProfile[];
  plans: LaunchPlan[];
  changeRequests: ChangeRequest[];
  mandate?: Mandate;
  wallet?: { address: string; keyRef: string; delegate: string; delegateRef: string; chain: "mock" | "devnet" | "localnet"; mint?: string };
  chain: { accounts: Record<string, { balance: Micro; delegate?: string; delegated: Micro }>; txs: ChainTx[] };
  ledger: LedgerEntry[];
  card: { frozen: boolean; txns: CardTxn[]; unbilled: Record<Platform, Micro>; threshold: Record<Platform, Micro> };
  campaigns: LiveCampaign[];
  creatives: Creative[];
  facts: MetricFact[];
  actions: AgentAction[];
  decisions: DecisionLogEntry[];
  dashboard?: DashboardSpec;
  reconciliations: Reconciliation[];
  ownerTasks: OwnerTask[];
  execution: ExecutionStep[];
  site?: { url: string; domain?: string; live: boolean; version: number };
  reports: WeeklyReport[];
  chat: ChatMessage[];
  /** Simulated clock: number of campaign days that have fully elapsed. */
  day: number;
  opsAccrued: Micro;
  llm: { provider: string; calls: number };
  killed?: { at: string; day: number; steps: string[] };
}

export function dateForDay(startDate: string, day: number): string {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return d.toISOString().slice(0, 10);
}
export function weekdayForDay(startDate: string, day: number): Day {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return DAYS[(d.getUTCDay() + 6) % 7];
}
