"use client";
import { AGE_RANGES, CATEGORIES, DAYS, DAY_LABEL, GOALS, GOAL_LABEL, PHOTO_TAGS, categoryById, fmtUsd, usd, type Day, type Offering, type OnboardingDraft, type Photo, type StepId } from "@storefront/core";
import { useId, useRef, useState } from "react";
import { Check, Receipt, Row } from "@/components/ui";

export type StepProps = { draft: OnboardingDraft; set: <K extends StepId>(step: K, data: NonNullable<OnboardingDraft[K]>) => void; businessId: string };

const hrs = (open: string, close: string, closed = false) => ({ open, close, closed });
export const DEFAULTS = {
  services: { website: true, google: true, apple: false, hasWebsite: false, existingUrl: "", hasGoogleListing: false, hasAppleListing: false },
  basics: { name: "", category: "", description: "" },
  offerings: { offerings: [] as Offering[] },
  location: { mode: "storefront" as "storefront" | "service_area", address: "", city: "", region: "", postal: "", hideAddress: false, radiusMiles: 5, areas: [] as string[], hours: Object.fromEntries(DAYS.map((d) => [d, hrs("09:00", "17:00", d === "sun")])) as Record<Day, { open: string; close: string; closed: boolean }> },
  contact: { phone: "", email: "", bookingUrl: "", instagram: "", facebook: "" },
  photos: { photos: [] as Photo[], noLogo: false, logo: undefined as Photo | undefined },
  customers: { ageRanges: [] as string[], gender: "any" as const, reach: "local" as const, radiusMiles: 5, languages: ["English"], interests: [] as string[], bestCustomer: "" },
  budget: { totalUsd: undefined as number | undefined, startDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), months: 3 as 1 | 3 | 6, renew: false, goal: undefined as string | undefined },
};
function val<K extends keyof typeof DEFAULTS>(draft: OnboardingDraft, step: K): (typeof DEFAULTS)[K] {
  return { ...DEFAULTS[step], ...(draft[step] as object) } as (typeof DEFAULTS)[K];
}

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children?: React.ReactNode }) {
  return (
    <button type="button" className="toggle-card" aria-pressed={on} onClick={onClick}>
      <span className="box">{on && <Check />}</span>
      <span>
        <span className="block font-bold">{title}</span>
        {children && <span className="hint block">{children}</span>}
      </span>
    </button>
  );
}
function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="mt-3">
      <legend className="label">{label}</legend>
      <div className="flex gap-2" role="radiogroup">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className="chip" onClick={() => onChange(v)}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Text({ label, value, onChange, hint, ...rest }: { label: string; value: string | undefined; onChange: (v: string) => void; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const hintId = useId();
  // The hint sits outside the label so the field's accessible name stays short; it is linked as a description.
  return (
    <div>
      <label className="block">
        <span className="label">{label}</span>
        <input className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? hintId : undefined} {...rest} />
      </label>
      {hint && (
        <span id={hintId} className="hint mt-1 block">
          {hint}
        </span>
      )}
    </div>
  );
}

export function ServicesStep({ draft, set }: StepProps) {
  const v = val(draft, "services");
  const up = (p: Partial<typeof v>) => set("services", { ...v, ...p, confirmed: true });
  return (
    <div className="space-y-3">
      <div className="toggle-card" style={{ cursor: "default", borderColor: "var(--ink)" }}>
        <span className="box" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }}>
          <Check />
        </span>
        <span>
          <span className="block font-bold">Ads on Google, Facebook and Instagram</span>
          <span className="hint block">Always included. This is the core of what we run for you.</span>
        </span>
      </div>
      <Toggle on={v.website} onClick={() => up({ website: !v.website })} title="A website">
        A fast, simple site built from your answers and photos, with its own domain name.
      </Toggle>
      <YesNo label="Do you already have a website?" value={v.hasWebsite} onChange={(hasWebsite) => up({ hasWebsite })} />
      {v.hasWebsite && <Text label="Its address" value={v.existingUrl} onChange={(existingUrl) => up({ existingUrl })} placeholder="https://" inputMode="url" hint={v.website ? "We will build the new site and can point your domain at it." : "We will send people from your ads to this site."} />}
      <Toggle on={v.google} onClick={() => up({ google: !v.google })} title="Google Business Profile">
        How you show up on Google Search and Maps: hours, photos, directions.
      </Toggle>
      {v.google && <YesNo label="Is your business already on Google Maps?" value={v.hasGoogleListing} onChange={(hasGoogleListing) => up({ hasGoogleListing })} />}
      <Toggle on={v.apple} onClick={() => up({ apple: !v.apple })} title="Apple Maps listing">
        For people who look you up on an iPhone. We prepare it; Apple asks you to submit it.
      </Toggle>
      {v.apple && <YesNo label="Are you already on Apple Maps?" value={v.hasAppleListing} onChange={(hasAppleListing) => up({ hasAppleListing })} />}
    </div>
  );
}

export function BasicsStep({ draft, set }: StepProps) {
  const v = val(draft, "basics");
  const up = (p: Partial<typeof v>) => set("basics", { ...v, ...p });
  const cat = v.category ? categoryById(v.category) : null;
  return (
    <div className="space-y-4">
      <Text label="Business name" value={v.name} onChange={(name) => up({ name })} autoComplete="organization" />
      <label className="block">
        <span className="label">What kind of business is it?</span>
        <select className="field" value={v.category} onChange={(e) => up({ category: e.target.value })}>
          <option value="">Choose the closest match</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {cat?.specialAdCategory && <span className="hint mt-1 block">Ad platforms have extra rules for this kind of business. We will follow them for you.</span>}
      </label>
      <div>
        <label className="block">
          <span className="label">Describe it in a sentence or two</span>
          <textarea className="field" value={v.description} onChange={(e) => up({ description: e.target.value })} placeholder="What you make or do, and what people come to you for." aria-describedby="desc-hint" />
        </label>
        <span id="desc-hint" className="hint mt-1 block">
          Your own words work best. We reuse them on your site and ads.{" "}
          {v.name && cat && !v.description && (
            <button type="button" className="link" onClick={() => up({ description: `${v.name} is a locally owned ${cat.label.split(" / ")[0].toLowerCase()}.` })}>
              Suggest a starting point
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

const newId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Turn a pasted menu or price list into cards. Rule-based; the owner confirms every card. */
export function parseMenu(text: string): Offering[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .map((line): Offering => {
      const range = line.match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:-|–|to)\s*\$?\s*(\d+(?:\.\d{1,2})?)/);
      const single = line.match(/(from|starting at)?\s*\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{2}))\s*$/i);
      const name = line
        .replace(/(from|starting at)?\s*\$?\s*\d+(?:\.\d{1,2})?(\s*(?:-|–|to)\s*\$?\s*\d+(?:\.\d{1,2})?)?\s*$/i, "")
        .replace(/[.·\-–:\s]+$/, "")
        .trim();
      if (range && line.includes("$")) return { id: newId(), name: name || line, priceType: "range", price: Number(range[1]), priceMax: Number(range[2]) };
      if (single) return { id: newId(), name: name || line, priceType: single[1] ? "from" : "fixed", price: Number(single[2] ?? single[3]) };
      return { id: newId(), name: line, priceType: "quote" };
    })
    .slice(0, 30);
}

export function OfferingsStep({ draft, set }: StepProps) {
  const v = val(draft, "offerings");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const up = (offerings: Offering[]) => set("offerings", { offerings });
  const edit = (id: string, p: Partial<Offering>) => up(v.offerings.map((o) => (o.id === id ? { ...o, ...p } : o)));
  return (
    <div className="space-y-4">
      {v.offerings.map((o, i) => (
        <div key={o.id} className="sheet space-y-3">
          <div className="flex items-start gap-2">
            <label className="block flex-1">
              <span className="label">Item {i + 1}</span>
              <input className="field" value={o.name} onChange={(e) => edit(o.id, { name: e.target.value })} placeholder="Name" />
            </label>
            <button type="button" className="link mt-9 text-sm" onClick={() => up(v.offerings.filter((x) => x.id !== o.id))} aria-label={`Remove ${o.name || "item"}`}>
              Remove
            </button>
          </div>
          <input className="field" value={o.description ?? ""} onChange={(e) => edit(o.id, { description: e.target.value })} placeholder="Short description (optional)" aria-label="Description" />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How it is priced">
            {(
              [
                ["fixed", "Set price"],
                ["from", "From"],
                ["range", "Range"],
                ["quote", "Call for quote"],
              ] as const
            ).map(([t, l]) => (
              <button key={t} type="button" role="radio" aria-checked={o.priceType === t} className="chip" onClick={() => edit(o.id, { priceType: t })}>
                {l}
              </button>
            ))}
          </div>
          {o.priceType !== "quote" && (
            <div className="flex items-center gap-2">
              <span aria-hidden>$</span>
              <input className="field num" inputMode="decimal" value={o.price ?? ""} onChange={(e) => edit(o.id, { price: e.target.value === "" ? undefined : Number(e.target.value) })} aria-label="Price" placeholder="0.00" />
              {o.priceType === "range" && (
                <>
                  <span>to $</span>
                  <input className="field num" inputMode="decimal" value={o.priceMax ?? ""} onChange={(e) => edit(o.id, { priceMax: e.target.value === "" ? undefined : Number(e.target.value) })} aria-label="Top price" placeholder="0.00" />
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-quiet" onClick={() => up([...v.offerings, { id: newId(), name: "", priceType: "fixed" }])}>
          Add an item
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setShowPaste(!showPaste)}>
          Paste a menu or price list
        </button>
      </div>
      {showPaste && (
        <div className="sheet space-y-3">
          <label className="block">
            <span className="label">Paste it here, one item per line</span>
            <textarea className="field" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Country sourdough $9\nMorning bun $4.50\nCakes from $65"} />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              up([...v.offerings.filter((o) => o.name), ...parseMenu(paste)]);
              setPaste("");
              setShowPaste(false);
            }}
          >
            Turn into items
          </button>
          <p className="hint">We split it into items for you to check. Nothing is used until you confirm it here.</p>
        </div>
      )}
    </div>
  );
}

export function LocationStep({ draft, set }: StepProps) {
  const v = val(draft, "location");
  const [area, setArea] = useState("");
  const up = (p: Partial<typeof v>) => set("location", { ...v, ...p });
  const setHours = (d: Day, p: Partial<{ open: string; close: string; closed: boolean }>) => up({ hours: { ...v.hours, [d]: { ...v.hours[d], ...p } } });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where you work">
        <button type="button" role="radio" aria-checked={v.mode === "storefront"} className="chip" onClick={() => up({ mode: "storefront" })}>
          Customers come to us
        </button>
        <button type="button" role="radio" aria-checked={v.mode === "service_area"} className="chip" onClick={() => up({ mode: "service_area" })}>
          We go to customers
        </button>
      </div>
      {v.mode === "storefront" && <Text label="Street address" value={v.address} onChange={(address) => up({ address })} autoComplete="street-address" />}
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-6 sm:col-span-3">
          <Text label="City" value={v.city} onChange={(city) => up({ city })} autoComplete="address-level2" />
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Text label="State" value={v.region} onChange={(region) => up({ region })} autoComplete="address-level1" maxLength={2} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Text label="ZIP" value={v.postal} onChange={(postal) => up({ postal })} autoComplete="postal-code" inputMode="numeric" />
        </div>
      </div>
      {v.mode === "storefront" ? (
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={v.hideAddress} onChange={(e) => up({ hideAddress: e.target.checked })} />
          <span>
            Hide my street address <span className="hint block">For home-based businesses. We show your city only.</span>
          </span>
        </label>
      ) : (
        <div>
          <span className="label">Other towns or ZIP codes you cover</span>
          <div className="flex gap-2">
            <input className="field" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Add a town or ZIP" aria-label="Add a town or ZIP" />
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                if (area.trim()) up({ areas: [...v.areas, area.trim()] });
                setArea("");
              }}
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {v.areas.map((a) => (
              <button key={a} type="button" className="chip" aria-pressed="true" onClick={() => up({ areas: v.areas.filter((x) => x !== a) })} aria-label={`Remove ${a}`}>
                {a} ×
              </button>
            ))}
          </div>
        </div>
      )}
      <fieldset>
        <legend className="label">Opening hours</legend>
        <div className="sheet divide-y-[1.5px] divide-line p-0">
          {DAYS.map((d) => (
            <div key={d} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{DAY_LABEL[d]}</span>
                <button type="button" className="link text-sm" onClick={() => setHours(d, { closed: !v.hours[d].closed })}>
                  {v.hours[d].closed ? "Open this day" : "Mark closed"}
                </button>
              </div>
              {v.hours[d].closed ? (
                <p className="hint">Closed</p>
              ) : (
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input type="time" className="field min-h-10 min-w-0 px-2 py-1" value={v.hours[d].open} onChange={(e) => setHours(d, { open: e.target.value })} aria-label={`${DAY_LABEL[d]} opens`} />
                  <span>to</span>
                  <input type="time" className="field min-h-10 min-w-0 px-2 py-1" value={v.hours[d].close} onChange={(e) => setHours(d, { close: e.target.value })} aria-label={`${DAY_LABEL[d]} closes`} />
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="link mt-2 text-sm" onClick={() => up({ hours: Object.fromEntries(DAYS.map((d) => [d, { ...v.hours.mon }])) as typeof v.hours })}>
          Copy Monday to every day
        </button>
      </fieldset>
    </div>
  );
}

export function ContactStep({ draft, set }: StepProps) {
  const v = val(draft, "contact");
  const up = (p: Partial<typeof v>) => set("contact", { ...v, ...p });
  return (
    <div className="space-y-4">
      <p className="hint">These are shown to customers. Your own login details stay private.</p>
      <Text label="Phone number for customers" value={v.phone} onChange={(phone) => up({ phone })} type="tel" autoComplete="tel" />
      <Text label="Email for customers" value={v.email} onChange={(email) => up({ email })} type="email" autoComplete="email" />
      <Text label="Booking or ordering link" value={v.bookingUrl} onChange={(bookingUrl) => up({ bookingUrl })} inputMode="url" placeholder="https://" hint="If you take bookings or orders online." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label="Instagram" value={v.instagram} onChange={(instagram) => up({ instagram })} placeholder="@yourshop" />
        <Text label="Facebook page" value={v.facebook} onChange={(facebook) => up({ facebook })} />
      </div>
    </div>
  );
}

const TAG_LABEL: Record<string, string> = { storefront: "Shop front", interior: "Inside", team: "People", product: "Product", work_sample: "Our work" };

export function PhotosStep({ draft, set, businessId }: StepProps) {
  const v = val(draft, "photos");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const up = (p: Partial<typeof v>) => set("photos", { ...v, ...p });

  async function upload(file: File): Promise<Photo | null> {
    let width = 0;
    let height = 0;
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
    } catch {
      /* dimensions unknown */
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/b/${businessId}/photos`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error);
      return null;
    }
    const warning = width && Math.max(width, height) < 1000 ? "This one is small and may look soft on a big screen. A larger copy would be better." : undefined;
    return { id: data.id, url: data.url, name: file.name, tag: "product", width, height, warning };
  }
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    const added: Photo[] = [];
    for (const f of Array.from(files).slice(0, 12)) {
      const p = await upload(f);
      if (p) added.push(p);
    }
    up({ photos: [...v.photos, ...added] });
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <p>Real photos of your place, your people and your work do more than anything else here. Phone photos are fine.</p>
      <div
        className="rounded-[14px] border-2 border-dashed border-blue bg-white p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void add(e.dataTransfer.files);
        }}
      >
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Uploading" : "Choose photos"}
        </button>
        <p className="hint mt-2">or drop them here. JPG, PNG or WebP.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void add(e.target.files)} />
      </div>
      {err && <p role="alert" className="text-brick">{err}</p>}
      {v.photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {v.photos.map((p) => (
            <li key={p.id} className="sheet p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
              <select className="field mt-2 min-h-10 py-1 text-sm" value={p.tag} onChange={(e) => up({ photos: v.photos.map((x) => (x.id === p.id ? { ...x, tag: e.target.value as Photo["tag"] } : x)) })} aria-label={`What ${p.name} shows`}>
                {PHOTO_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {TAG_LABEL[t]}
                  </option>
                ))}
              </select>
              {p.warning && <p className="hint mt-1 text-xs">{p.warning}</p>}
              <button type="button" className="link mt-1 text-sm" onClick={() => up({ photos: v.photos.filter((x) => x.id !== p.id) })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rule pt-4">
        <span className="label">Logo</span>
        {v.logo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.logo.url} alt="Your logo" className="h-16 w-16 rounded-lg bg-white object-contain" />
            <button type="button" className="link" onClick={() => up({ logo: undefined })}>
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => logoInput.current?.click()}>
              Upload a logo
            </button>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={!!v.noLogo} onChange={(e) => up({ noLogo: e.target.checked })} /> I don&apos;t have one
            </label>
            <input
              ref={logoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const p = await upload(f);
                  if (p) up({ logo: p, noLogo: false });
                }
              }}
            />
          </div>
        )}
        {v.noLogo && <p className="hint mt-1">No problem. We will set your name in the site&apos;s lettering instead.</p>}
      </div>
    </div>
  );
}

function Chips({ options, value, onChange, label }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function CustomersStep({ draft, set }: StepProps) {
  const v = val(draft, "customers");
  const cat = categoryById(draft.basics?.category);
  const up = (p: Partial<typeof v>) => set("customers", { ...v, ...p } as NonNullable<OnboardingDraft["customers"]>);
  const special = !!cat.specialAdCategory;
  const interestOptions = Array.from(new Set([...cat.interests, ...v.interests]));
  return (
    <div className="space-y-5">
      <p className="hint">We treat these as a starting guess and test them. They do not lock anyone out.</p>
      <fieldset>
        <legend className="label">How old are most of your customers?</legend>
        <Chips options={AGE_RANGES} value={v.ageRanges} onChange={(ageRanges) => up({ ageRanges })} label="Age ranges" />
        {special && <p className="hint mt-2">For your kind of business, ad platforms do not allow targeting by age, gender or ZIP code. We still use this to shape the wording.</p>}
      </fieldset>
      <fieldset>
        <legend className="label">Mostly women, mostly men, or a mix?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(
            [
              ["any", "A mix"],
              ["mostly_women", "Mostly women"],
              ["mostly_men", "Mostly men"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={v.gender === k} className="chip" onClick={() => up({ gender: k as never })}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Where do they come from?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(
            [
              ["local", "Nearby"],
              ["city", "Across the city"],
              ["regional", "The wider region"],
              ["national", "Anywhere (online)"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={v.reach === k} className="chip" onClick={() => up({ reach: k as never })}>
              {l}
            </button>
          ))}
        </div>
        {v.reach === "local" && (
          <label className="mt-3 block">
            <span className="hint">
              Within about <strong className="text-ink">{v.radiusMiles} miles</strong>
            </span>
            <input type="range" min={1} max={30} value={v.radiusMiles} onChange={(e) => up({ radiusMiles: Number(e.target.value) })} className="mt-1 w-full accent-[var(--blue)]" aria-label="Radius in miles" />
          </label>
        )}
      </fieldset>
      <fieldset>
        <legend className="label">What are they into?</legend>
        <Chips options={interestOptions} value={v.interests} onChange={(interests) => up({ interests })} label="Interests" />
      </fieldset>
      <fieldset>
        <legend className="label">Languages they speak</legend>
        <Chips options={["English", "Spanish", "Chinese", "Vietnamese", "Tagalog", "Arabic", "French", "Korean"]} value={v.languages} onChange={(languages) => up({ languages })} label="Languages" />
      </fieldset>
      <Text label="Who is your best customer?" value={v.bestCustomer} onChange={(bestCustomer) => up({ bestCustomer })} placeholder="One sentence is plenty" />
    </div>
  );
}

export function BudgetStep({ draft, set }: StepProps) {
  const v = val(draft, "budget");
  const cat = categoryById(draft.basics?.category);
  const up = (p: Partial<typeof v>) => set("budget", { ...v, ...p } as NonNullable<OnboardingDraft["budget"]>);
  const total = v.totalUsd ?? 0;
  const ad = Math.floor(usd(total) * 0.8);
  const days = v.months * 30;
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="label">Total marketing budget</span>
        <div className="flex items-center gap-2">
          <span className="display text-2xl" aria-hidden>
            $
          </span>
          <input className="field num text-xl" inputMode="numeric" value={v.totalUsd ?? ""} onChange={(e) => up({ totalUsd: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9.]/g, "")) })} placeholder="1500" aria-label="Total budget in dollars" />
        </div>
        <span className="hint mt-1 block">
          {cat.id === "other" ? "Businesses like yours" : `A ${cat.label.split(" / ")[0].toLowerCase()}`} usually starts with ${cat.budgetGuide[0]} to ${cat.budgetGuide[1].toLocaleString("en-US")} a month.
        </span>
      </label>
      <fieldset>
        <legend className="label">For how long?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {([1, 3, 6] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={v.months === m} className="chip" onClick={() => up({ months: m })}>
              {m === 1 ? "1 month" : `${m} months`}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={v.renew} onChange={(e) => up({ renew: e.target.checked })} /> Ask me about renewing when it ends
        </label>
      </fieldset>
      <label className="block">
        <span className="label">Start date</span>
        <input type="date" className="field" value={v.startDate} onChange={(e) => up({ startDate: e.target.value })} />
      </label>
      <fieldset>
        <legend className="label">What matters most?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {GOALS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={v.goal === g} className="chip" onClick={() => up({ goal: g })}>
              {GOAL_LABEL[g].name}
            </button>
          ))}
        </div>
      </fieldset>
      {total >= 100 && (
        <Receipt title="How your budget is used">
          <Row label="Ads on Google, Facebook, Instagram (80%)" value={fmtUsd(ad)} note={`About ${fmtUsd(Math.floor(ad / days))} a day for ${days} days`} />
          <Row label="Your AI marketer's running costs (20%)" value={fmtUsd(usd(total) - ad)} note="Held in reserve. Whatever is not used stays yours." />
          <Row label="Your budget" value={fmtUsd(usd(total))} total />
          <div className="mt-3">
            <Row label={`Storefront, $20 a month × ${v.months}`} value={fmtUsd(usd(20 * v.months))} note="Charged separately from your budget. A domain name, if you want one, is added at cost." />
          </div>
        </Receipt>
      )}
      <p className="hint">Advertising results are never guaranteed. We show honest ranges in your plan, and you can stop at any time and keep what is unspent.</p>
    </div>
  );
}
