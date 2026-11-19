"use client";
import { ATTRIBUTE_LABEL, type Creative, type Photo } from "@storefront/core";
import { artOf } from "./art";

/** Ads are rendered in code from the brand tokens, so site, ads and listings look like one business. */
export function AdPreview({ creative, businessName, domain, art, photos, badge }: { creative: Creative; businessName: string; domain?: string; art?: string; photos: Photo[]; badge?: React.ReactNode }) {
  const a = artOf(art);
  const photo = photos.find((p) => p.id === creative.photoId);
  const tags = [ATTRIBUTE_LABEL[creative.attributes.hook], creative.attributes.offer !== "none" ? ATTRIBUTE_LABEL[creative.attributes.offer] : null].filter(Boolean);
  if (creative.platform === "google")
    return (
      <figure className="w-[300px] flex-none rounded-xl border-[1.5px] border-line bg-white p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold">Sponsored</span>
          {badge}
        </div>
        <p className="mt-1 truncate text-sm text-muted">{domain ?? "google.com/maps"}</p>
        <p className="mt-0.5 text-[1.1rem] leading-snug text-[#1a0dab]">{creative.headline}</p>
        <p className="mt-1 text-sm leading-snug">{creative.body}</p>
        <figcaption className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </figcaption>
      </figure>
    );
  const tall = creative.format === "story_9x16";
  return (
    <figure className="w-[260px] flex-none overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold" style={{ background: a.accent, color: a.accentInk }}>
          {businessName.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold leading-tight">{businessName}</span>
          <span className="block text-xs text-muted">Sponsored</span>
        </span>
        <span className="ml-auto">{badge}</span>
      </div>
      <p className="px-3 pb-2 text-sm leading-snug">{creative.body}</p>
      <div className="relative grid place-items-center overflow-hidden" style={{ aspectRatio: tall ? "4 / 5" : creative.format === "square_1x1" ? "1 / 1" : "4 / 5", background: a.bg, color: a.ink }}>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-lg leading-tight" style={{ background: a.accent, color: a.accentInk, fontFamily: a.display, fontWeight: a.displayWeight }}>
              {creative.headline}
            </span>
          </>
        ) : (
          <div className="p-5">
            <span className="block text-[1.7rem] leading-[1.02]" style={{ fontFamily: a.display, fontWeight: a.displayWeight, letterSpacing: a.tracking }}>
              {creative.headline}
            </span>
            <span className="mt-3 inline-block px-2 py-1 text-sm font-bold" style={{ background: a.accent, color: a.accentInk, borderRadius: a.radius }}>
              {businessName}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0 truncate text-sm font-bold">{creative.headline}</span>
        <span className="flex-none rounded-md bg-sky px-2 py-1 text-sm font-bold">{creative.cta}</span>
      </div>
      <figcaption className="flex flex-wrap gap-1 px-3 pb-3">
        {tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
