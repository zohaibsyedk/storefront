import { DAYS, DAY_LABEL, categoryById, type BusinessProfile, type Creative, type CreativeAttributes, type Goal, type Offering, type Platform } from "@storefront/core";

export type Tone = "warm" | "plain" | "formal";

/** Words that make copy read as machine-written or that make claims we cannot support. */
export const BANNED_COPY = [/\belevate\b/i, /\bunlock\b/i, /\bseamless/i, /\bunleash\b/i, /\bgame.?chang/i, /\bworld.?class\b/i, /\bcutting.?edge\b/i, /\btransform your\b/i, /\bnext level\b/i];
export const CLAIM_WORDS = [/\bbest\b/i, /#1\b/, /\bnumber one\b/i, /\bguarantee/i, /\bcheapest\b/i, /\bcure/i, /\b100%\b/, /\baward.?winning\b/i];

export function lintCopy(text: string): string[] {
  const notes: string[] = [];
  for (const r of BANNED_COPY) if (r.test(text)) notes.push(`Uses filler wording (${r.source.replace(/\\b|\\/g, "")})`);
  for (const r of CLAIM_WORDS) if (r.test(text)) notes.push(`Makes a claim that needs your approval (${r.source.replace(/\\b|\\/g, "")})`);
  return notes;
}

export function priceText(o: Offering): string {
  const f = (n?: number) => (n === undefined ? "" : Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
  if (o.priceType === "fixed") return f(o.price);
  if (o.priceType === "from") return `from ${f(o.price)}`;
  if (o.priceType === "range") return `${f(o.price)}–${f(o.priceMax)}`;
  return "";
}

export function cityOf(p: BusinessProfile): string {
  return p.location.city?.trim() || p.location.areas[0] || "your area";
}
export function streetOf(p: BusinessProfile): string | null {
  if (p.location.mode !== "storefront" || p.location.hideAddress || !p.location.address) return null;
  const s = p.location.address.replace(/^\s*\d+[A-Za-z]?\s+/, "").replace(/,.*$/, "").trim();
  return s || null;
}
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}
export function hoursLines(p: BusinessProfile): { day: string; text: string }[] {
  return DAYS.map((d) => {
    const h = p.location.hours[d];
    return { day: DAY_LABEL[d], text: !h || h.closed ? "Closed" : `${fmtTime(h.open)} to ${fmtTime(h.close)}` };
  });
}
export function hoursSummary(p: BusinessProfile): string {
  const open = DAYS.filter((d) => p.location.hours[d] && !p.location.hours[d].closed);
  if (open.length === 0) return "";
  const first = p.location.hours[open[0]];
  const same = open.every((d) => p.location.hours[d].open === first.open && p.location.hours[d].close === first.close);
  const span = open.length === 7 ? "every day" : `${DAY_LABEL[open[0]].slice(0, 3)} to ${DAY_LABEL[open[open.length - 1]].slice(0, 3)}`;
  return same ? `Open ${span}, ${fmtTime(first.open)} to ${fmtTime(first.close)}` : `Open ${span}`;
}

export function orderedOfferings(p: BusinessProfile, emphasis?: string): Offering[] {
  const list = p.offerings.slice();
  if (!emphasis) return list;
  const e = emphasis.toLowerCase();
  const score = (o: Offering) => (o.name.toLowerCase().includes(e) || e.includes(o.name.toLowerCase()) || (o.description ?? "").toLowerCase().includes(e) ? 1 : 0);
  return list.sort((a, b) => score(b) - score(a));
}

export const CTA_BY_GOAL: Record<Goal, string> = { calls: "Call now", bookings: "Book now", foot_traffic: "Get directions", online_orders: "Order now", leads: "Get a quote" };

function fit(candidates: string[], max: number): string {
  for (const c of candidates) if (c.length <= max) return c;
  const last = candidates[candidates.length - 1];
  return last.slice(0, max).replace(/\s+\S*$/, "");
}
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const sentence = (s: string) => {
  const t = s.trim();
  return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : "";
};
function firstSentence(s: string): string {
  const m = s.trim().match(/^[^.!?]+[.!?]?/);
  return sentence(m ? m[0] : s);
}

export function toneText(tone: Tone, v: { warm: string; plain: string; formal: string }): string {
  return v[tone];
}

/** Deterministic ("house") ad copy. Uses only facts the owner gave us; invents no offers, reviews or claims. */
export function writeCreative(p: BusinessProfile, platform: Platform, attrs: CreativeAttributes, tone: Tone, emphasis?: string): { headline: string; body: string; cta: string } {
  const cat = categoryById(p.basics.category);
  const offs = orderedOfferings(p, emphasis);
  const top = offs[0];
  const second = offs[1];
  const city = cityOf(p);
  const street = streetOf(p);
  const name = p.basics.name.trim();
  const catLabel = cat.id === "other" ? name : cat.label.split(" / ")[0];
  const max = platform === "google" ? 30 : 40;
  const openDays = DAYS.filter((d) => p.location.hours[d] && !p.location.hours[d].closed);
  const openFrom = openDays.length ? fmtTime(p.location.hours[openDays[0]].open) : null;
  const openLine = openDays.length ? (openDays.length === 7 ? `Open every day from ${openFrom}` : `Open ${DAY_LABEL[openDays[0]].slice(0, 3)} to ${DAY_LABEL[openDays[openDays.length - 1]].slice(0, 3)} from ${openFrom}`) : null;
  const pt = top ? priceText(top) : "";

  let headline: string;
  switch (attrs.hook) {
    case "question":
      headline = fit([`Looking for ${lower(top?.name ?? catLabel)} in ${city}?`, `${top?.name ?? catLabel} in ${city}?`, `${top?.name ?? catLabel} near you?`, `${catLabel} near you?`], max);
      break;
    case "offer_led":
      headline =
        attrs.offer === "bundle" && top && second
          ? fit([`${top.name} and ${lower(second.name)}`, `${top.name} & ${lower(second.name)}`, top.name], max)
          : fit(pt ? [`${top.name}, ${pt}`, `${top.name} ${pt}`, top.name] : [`${top?.name ?? catLabel} in ${city}`, top?.name ?? catLabel], max);
      break;
    case "local_pride":
      headline = fit(street ? [`${catLabel} on ${street}`, `${city}'s ${lower(catLabel)}`, `${catLabel} in ${city}`] : [`${catLabel} for ${city}`, `${city}'s ${lower(catLabel)}`, `${catLabel}, ${city}`], max);
      break;
    case "craft_story":
      headline = fit([`${name}, ${city}`, name, catLabel], max);
      break;
    default:
      headline = fit(openLine ? [openLine, `Open from ${openFrom}`] : [`Booking this week in ${city}`, `Booking this week`], max);
  }

  let offerLine = "";
  if (top) {
    if (attrs.offer === "signature_item") offerLine = toneText(tone, { warm: `Start with the ${lower(top.name)}${pt ? ` (${pt})` : ""}.`, plain: `${top.name}${pt ? `: ${pt}` : ""}.`, formal: `We recommend the ${lower(top.name)}${pt ? `, ${pt}` : ""}.` });
    else if (attrs.offer === "first_visit") offerLine = toneText(tone, { warm: `First time in? Ask for the ${lower(top.name)}.`, plain: `New here? Try the ${lower(top.name)}.`, formal: `New customers often begin with the ${lower(top.name)}.` });
    else if (attrs.offer === "bundle" && second) offerLine = toneText(tone, { warm: `${top.name} and ${lower(second.name)}, sorted in one stop.`, plain: `${top.name}. ${second.name}.`, formal: `We offer ${lower(top.name)} and ${lower(second.name)}.` });
  }
  const where = street ? `${street}, ${city}.` : `Serving ${city}${p.location.areas.length > 1 ? " and nearby" : ""}.`;
  const hours = hoursSummary(p);
  const angle =
    attrs.angle === "convenience" ? (hours ? `${hours}.` : "") : attrs.angle === "local" ? toneText(tone, { warm: `Run by people who live here.`, plain: `Locally owned.`, formal: `A locally owned business.` }) : attrs.angle === "price" && pt ? toneText(tone, { warm: `Honest prices, ${pt} for the ${lower(top.name)}.`, plain: `Prices ${pt}.`, formal: `Transparent pricing, ${pt}.` }) : "";
  const story = attrs.hook === "craft_story" || attrs.angle === "quality" ? firstSentence(p.basics.description) : "";
  const parts = [story || (attrs.hook === "question" ? firstSentence(p.basics.description) : ""), offerLine, angle, where].filter(Boolean);
  let body = Array.from(new Set(parts.map((x) => x.trim()))).join(" ");
  const bodyMax = platform === "google" ? 90 : 180;
  if (body.length > bodyMax) {
    const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [body];
    body = "";
    for (const s of sentences) if (`${body} ${s.trim()}`.trim().length <= bodyMax) body = `${body} ${s.trim()}`.trim();
    body = body.trim() || sentences[0].slice(0, bodyMax).replace(/\s+\S*$/, "");
  }
  return { headline, body, cta: CTA_BY_GOAL[p.budget.goal] };
}

export function policyCheck(p: BusinessProfile, c: Pick<Creative, "headline" | "body" | "platform">): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const cat = categoryById(p.basics.category);
  if (c.platform === "google" && c.headline.length > 30) notes.push("Google headline is over 30 characters");
  if (c.platform === "google" && c.body.length > 90) notes.push("Google description is over 90 characters");
  for (const r of CLAIM_WORDS) if (r.test(`${c.headline} ${c.body}`)) notes.push("Contains a claim (best, guaranteed…) that needs your approval first");
  if (/[A-Z]{6,}/.test(c.headline)) notes.push("Headline shouts in capitals");
  if (/!{2,}/.test(`${c.headline}${c.body}`)) notes.push("Repeated exclamation marks");
  if (cat.specialAdCategory) notes.push(`Runs as a special ad category (${cat.specialAdCategory}): no age, gender or ZIP targeting`);
  const blocking = notes.filter((n) => !n.startsWith("Runs as"));
  return { ok: blocking.length === 0, notes };
}
