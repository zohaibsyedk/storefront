import type { Photo, SiteDraft, SiteSection } from "@storefront/core";
import { artOf, type ArtDirection } from "./art";

type P = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function Img({ photo, className }: { photo?: Photo; className?: string }) {
  if (!photo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={`${photo.tag.replace("_", " ")} photo`} className={className} loading="lazy" />;
}

function H({ a, children }: { a: ArtDirection; children: React.ReactNode }) {
  return <h2 style={{ fontFamily: a.display, fontWeight: a.displayWeight, letterSpacing: a.tracking, fontSize: "clamp(1.6rem, 5vw, 2.4rem)", lineHeight: 1.05 }}>{children}</h2>;
}

function Section({ s, a, photos }: { s: SiteSection; a: ArtDirection; photos: Photo[] }) {
  const p = s.props as P;
  const find = (id: unknown) => photos.find((x) => x.id === id);
  const btn = { background: a.accent, color: a.accentInk, borderRadius: a.radius, fontWeight: 700, padding: "0.85rem 1.3rem", display: "inline-block" } as const;
  switch (s.type) {
    case "hero": {
      const cta = p.cta as { label: string; href: string };
      const photo = find(p.photoId);
      return (
        <header style={{ background: a.bg }}>
          <div className="mx-auto max-w-5xl px-5 pb-10 pt-6">
            <p style={{ fontFamily: a.display, fontWeight: a.displayWeight, fontSize: "1.15rem" }}>{str(p.name)}</p>
            <div className={`mt-10 grid items-end gap-8 ${photo ? "md:grid-cols-[1.1fr_1fr]" : ""}`}>
              <div>
                <h1 style={{ fontFamily: a.display, fontWeight: a.displayWeight, letterSpacing: a.tracking, fontSize: photo ? "clamp(2.6rem, 9vw, 4.6rem)" : "clamp(3rem, 13vw, 7rem)", lineHeight: 0.95, textWrap: "balance" }}>{str(p.headline)}</h1>
                <p className="mt-5 max-w-xl text-lg">{str(p.sub)}</p>
                <a href={cta.href} className="mt-6" style={btn}>
                  {cta.label}
                </a>
              </div>
              {photo && <Img photo={photo} className="aspect-[4/5] w-full object-cover" />}
            </div>
          </div>
          {a.id === "sign_painter" && <div style={{ height: 14, background: `repeating-linear-gradient(90deg, ${a.accent} 0 22px, ${a.panel} 22px 44px)` }} />}
        </header>
      );
    }
    case "menu": {
      const items = p.items as { name: string; description: string; price: string; duration: string }[];
      return (
        <section style={{ background: a.panel }}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <H a={a}>{str(p.heading)}</H>
            <ul className="mt-6 grid gap-x-10 md:grid-cols-2">
              {items.map((it) => (
                <li key={it.name} className="flex items-baseline gap-3 py-3" style={{ borderBottom: `1.5px solid ${a.ink}22` }}>
                  <span className="min-w-0">
                    <span className="block text-lg font-bold">{it.name}</span>
                    {it.description && <span className="block opacity-80">{it.description}</span>}
                  </span>
                  <span className="ml-auto flex-none text-lg" style={{ fontFamily: a.display, fontWeight: a.displayWeight, fontVariantNumeric: "tabular-nums" }}>
                    {it.price}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }
    case "gallery":
      return (
        <section style={{ background: a.bg }}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <H a={a}>{str(p.heading)}</H>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              {(p.photoIds as string[]).map((id, i) => (
                <Img key={id} photo={find(id)} className={`w-full object-cover ${i % 5 === 0 ? "aspect-[4/5]" : "aspect-square"}`} />
              ))}
            </div>
          </div>
        </section>
      );
    case "story": {
      const photo = find(p.photoId);
      return (
        <section style={{ background: a.bg }}>
          <div className={`mx-auto grid max-w-5xl gap-8 px-5 py-12 ${photo ? "md:grid-cols-2" : ""}`}>
            {photo && <Img photo={photo} className="aspect-[4/3] w-full object-cover" />}
            <div>
              <H a={a}>{str(p.heading)}</H>
              <p className="mt-4 max-w-prose text-lg">{str(p.text)}</p>
            </div>
          </div>
        </section>
      );
    }
    case "hours_map": {
      const hours = p.hours as { day: string; text: string }[];
      return (
        <section style={{ background: a.ink, color: a.panel }}>
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-2">
            <div>
              <H a={a}>{str(p.heading)}</H>
              <p className="mt-4 text-lg">{str(p.address)}</p>
              {!p.hideAddress && (
                <a className="mt-3 inline-block underline underline-offset-4" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(str(p.mapQuery))}`}>
                  Open in Maps
                </a>
              )}
            </div>
            <table className="w-full text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
              <caption className="sr-only">Opening hours</caption>
              <tbody>
                {hours.map((h) => (
                  <tr key={h.day} style={{ borderBottom: `1px solid ${a.panel}33` }}>
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {h.day}
                    </th>
                    <td className={`py-2 text-right ${h.text === "Closed" ? "opacity-60" : "font-bold"}`}>{h.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    }
    case "faq":
      return (
        <section style={{ background: a.panel }}>
          <div className="mx-auto max-w-3xl px-5 py-12">
            <H a={a}>{str(p.heading)}</H>
            <dl className="mt-5">
              {(p.items as { q: string; a: string }[]).map((f) => (
                <div key={f.q} className="py-3" style={{ borderBottom: `1.5px solid ${a.ink}22` }}>
                  <dt className="text-lg font-bold">{f.q}</dt>
                  <dd className="mt-1">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      );
    case "cta_band": {
      const cta = p.cta as { label: string; href: string };
      return (
        <section style={{ background: a.accent, color: a.accentInk }}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-10">
            <p style={{ fontFamily: a.display, fontWeight: a.displayWeight, fontSize: "clamp(1.6rem, 6vw, 2.6rem)", lineHeight: 1 }}>{str(p.text)}</p>
            <a href={cta.href} style={{ ...btn, background: a.accentInk, color: a.accent }}>
              {cta.label}
            </a>
          </div>
        </section>
      );
    }
    case "contact":
      return (
        <section id="contact" style={{ background: a.bg }}>
          <div className="mx-auto max-w-5xl px-5 py-12">
            <H a={a}>Get in touch</H>
            <ul className="mt-4 space-y-2 text-lg">
              {str(p.phone) && (
                <li>
                  <a className="underline underline-offset-4" href={`tel:${str(p.phone).replace(/[^0-9+]/g, "")}`}>
                    {str(p.phone)}
                  </a>
                </li>
              )}
              {str(p.email) && (
                <li>
                  <a className="underline underline-offset-4" href={`mailto:${str(p.email)}`}>
                    {str(p.email)}
                  </a>
                </li>
              )}
              {str(p.bookingUrl) && (
                <li>
                  <a className="underline underline-offset-4" href={str(p.bookingUrl)}>
                    Book or order online
                  </a>
                </li>
              )}
              {str(p.instagram) && <li>Instagram {str(p.instagram)}</li>}
            </ul>
          </div>
        </section>
      );
    case "footer":
      return (
        <footer style={{ background: a.ink, color: a.panel }}>
          <div className="mx-auto max-w-5xl px-5 py-6 text-sm opacity-90">
            {str(p.name)}, {str(p.address)}
            {str(p.phone) ? `, ${str(p.phone)}` : ""}
          </div>
        </footer>
      );
    default:
      return null;
  }
}

export function SiteRenderer({ site, photos }: { site: SiteDraft; photos: Photo[] }) {
  const a = artOf(site.artDirection);
  return (
    <div style={{ background: a.bg, color: a.ink, fontFamily: a.body, fontSize: 17, lineHeight: 1.5, minHeight: "100dvh" }}>
      {site.sections.map((s) => (
        <Section key={s.id} s={s} a={a} photos={photos} />
      ))}
    </div>
  );
}
