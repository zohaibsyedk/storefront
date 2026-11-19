/** Money is integer micro-USDC (1 USDC = 1_000_000). Never use floats for balances. */
export type Micro = number;

export const MICRO = 1_000_000;

export function usd(dollars: number): Micro {
  return Math.round(dollars * MICRO);
}

export function toUsd(m: Micro): number {
  return m / MICRO;
}

export function assertMicro(m: Micro, label = "amount"): void {
  if (!Number.isSafeInteger(m)) throw new Error(`${label} must be an integer micro-USDC, got ${m}`);
}

export function fmtUsd(m: Micro, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  const v = toUsd(m) || 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

/** Split `total` across `weights` so the parts are integers and sum exactly to `total`. */
export function splitByWeights(total: Micro, weights: number[]): Micro[] {
  assertMicro(total, "total");
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) {
    const even = weights.map(() => 1);
    return splitByWeights(total, even);
  }
  const raw = weights.map((w) => (Math.max(0, w) / sum) * total);
  const floors = raw.map((r) => Math.floor(r));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) floors[order[k].i] += 1;
  return floors;
}

export function share(total: Micro, fraction: number): Micro {
  return Math.floor(total * fraction);
}
