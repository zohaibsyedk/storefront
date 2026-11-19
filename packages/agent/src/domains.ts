import { categoryById, hashString, usd, type BusinessProfile, type DomainSuggestion, type Micro } from "@storefront/core";
import { cityOf } from "./copy";

/** Registrar behind an interface: Cloudflare Registrar and Vercel are the real targets, this is the local fake. */
export interface Registrar {
  id: string;
  check(domain: string): Promise<{ available: boolean; price: Micro; renewal: Micro; premium: boolean; supported: boolean }>;
  register(domain: string, idempotencyKey: string, expectedPrice: Micro): Promise<{ status: "registered" | "price_changed" | "unavailable"; orderId: string }>;
}

const TLD_PRICE: Record<string, [number, number]> = {
  com: [10.46, 10.46],
  co: [26.0, 26.0],
  net: [11.84, 11.84],
  shop: [2.5, 30.5],
  cafe: [24.18, 24.18],
  studio: [20.18, 20.18],
  biz: [15.18, 15.18],
};
const TAKEN_WORDS = new Set(["bakery", "coffee", "plumber", "salon", "flowers", "pizza", "fitness", "dental"]);

export class MockRegistrar implements Registrar {
  id = "mock";
  private orders = new Map<string, string>();
  async check(domain: string) {
    const [label, ...rest] = domain.split(".");
    const tld = rest.join(".");
    const price = TLD_PRICE[tld];
    if (!price) return { available: false, price: 0, renewal: 0, premium: false, supported: false };
    const h = hashString(`avail:${domain}`) % 100;
    const generic = TAKEN_WORDS.has(label) || label.length <= 4;
    const available = !generic && (tld === "com" ? h < 68 : h < 92);
    const premium = available && label.length <= 6 && h % 7 === 0;
    return { available, price: usd(premium ? price[0] * 40 : price[0]), renewal: usd(price[1]), premium, supported: true };
  }
  async register(domain: string, idempotencyKey: string, expectedPrice: Micro) {
    const existing = this.orders.get(idempotencyKey);
    if (existing) return { status: "registered" as const, orderId: existing };
    const c = await this.check(domain);
    if (!c.available) return { status: "unavailable" as const, orderId: "" };
    if (c.price !== expectedPrice) return { status: "price_changed" as const, orderId: "" };
    const orderId = `ord_${hashString(idempotencyKey).toString(36)}`;
    this.orders.set(idempotencyKey, orderId);
    return { status: "registered" as const, orderId };
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const TRADEMARK_NEAR = ["starbucks", "google", "apple", "nike", "amazon", "disney", "mcdonald", "tesla", "meta"];

/** DomainScout: generate candidates, score them, keep the 5–8 best that are available. */
export async function scoutDomains(p: BusinessProfile, registrar: Registrar): Promise<DomainSuggestion[]> {
  const cat = categoryById(p.basics.category);
  const name = slug(p.basics.name);
  const city = slug(cityOf(p));
  const catWord = slug(cat.label.split(" / ")[0]);
  const words = p.basics.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const first = slug(words[0] ?? name);
  const hasCat = name.includes(catWord);
  const labels = Array.from(
    new Set([
      name,
      `${name}${city}`,
      hasCat ? `${first}${city}` : `${name}${catWord}`,
      `${first}${catWord}`,
      `visit${name}`,
      `${name}co`,
      `${first}and${slug(words[words.length - 1] ?? "")}`,
      `get${first}`,
      `${first}${city}${catWord}`,
      `the${name}`,
      `${name}shop`,
      `hello${first}`,
      `${first}${catWord}co`,
      `${name}${slug(p.location.region ?? "")}`,
    ]),
  ).filter((l) => l.length >= 5 && l.length <= 28);
  const tldFor = (label: string) => {
    const t = ["com"];
    if (label === name) t.push("co", cat.id === "cafe" || cat.id === "bakery" ? "cafe" : cat.id === "retail" || cat.id === "florist" ? "shop" : "net");
    return t;
  };
  const out: DomainSuggestion[] = [];
  for (const label of labels) {
    for (const tld of tldFor(label)) {
      const domain = `${label}.${tld}`;
      const c = await registrar.check(domain);
      if (!c.supported || !c.available || c.premium) continue;
      const reasons: string[] = [];
      const flags: string[] = [];
      let score = 60;
      if (label.length <= 14) ((score += 14), reasons.push("Short enough to type from memory"));
      else if (label.length <= 20) score += 6;
      else ((score -= 8), flags.push("Long"));
      if (tld === "com") ((score += 12), reasons.push(".com is what people try first"));
      else reasons.push(`.${tld} is less familiar than .com`);
      if (label === name) ((score += 10), reasons.push("Exactly your business name"));
      if (label.includes(city) && city !== "yourarea") ((score += 5), reasons.push(`Names ${cityOf(p)}, which helps local search`));
      if (/(.)\1\1/.test(label) || /[aeiou]{3}/.test(label)) ((score -= 6), flags.push("Hard to spell when heard aloud"));
      if (/(\w)\1/.test(label.replace(name, ""))) score -= 1;
      if (c.renewal > c.price) flags.push(`Renews at $${(c.renewal / 1e6).toFixed(2)} a year`);
      if (TRADEMARK_NEAR.some((t) => label.includes(t))) ((score -= 30), flags.push("Contains a well-known brand name. Check with a lawyer before using it"));
      out.push({ domain, price: c.price, renewal: c.renewal, score: Math.max(0, Math.min(100, score)), reasons, flags });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.domain.length - b.domain.length).slice(0, 8);
}
