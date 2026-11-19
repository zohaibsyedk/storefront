import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadBusiness } from "@storefront/agent";
import { SiteRenderer } from "@/components/SiteRenderer";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> };
export const dynamic = "force-dynamic";

function load(id: string, v?: string) {
  const state = loadBusiness(id);
  if (!state) return null;
  const plan = (v && state.plans.find((p) => String(p.version) === v)) || state.plans.at(-1);
  const profile = state.profiles.at(-1);
  if (!plan?.site || !profile) return null;
  return { plan, profile, state };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const got = load((await params).id, (await searchParams).v);
  return got ? { title: got.plan.site!.title, description: got.plan.site!.metaDescription } : {};
}

export default async function GeneratedSite({ params, searchParams }: Props) {
  const got = load((await params).id, (await searchParams).v);
  if (!got) notFound();
  const { plan, profile } = got;
  const loc = profile.location;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.basics.name,
    description: profile.basics.description,
    telephone: profile.contact.phone || undefined,
    address: loc.hideAddress ? { "@type": "PostalAddress", addressLocality: loc.city, addressRegion: loc.region } : { "@type": "PostalAddress", streetAddress: loc.address, addressLocality: loc.city, addressRegion: loc.region, postalCode: loc.postal },
    url: plan.site!.chosenDomain ? `https://${plan.site!.chosenDomain}` : undefined,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteRenderer site={plan.site!} photos={profile.photos.photos} />
    </>
  );
}
