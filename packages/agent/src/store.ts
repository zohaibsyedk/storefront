import fs from "node:fs";
import path from "node:path";
import { shortId, usd, type BusinessState } from "@storefront/core";

/**
 * File-backed store: one JSON document per business. It sits behind these few
 * functions so it can be swapped for Postgres (ADR-0003) without touching callers.
 */
export function dataDir(): string {
  if (process.env.STOREFRONT_DATA_DIR) return process.env.STOREFRONT_DATA_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "packages")) && fs.existsSync(path.join(dir, "apps"))) return path.join(dir, ".data");
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), ".data");
}
const file = (id: string) => path.join(dataDir(), "businesses", `${id.replace(/[^a-zA-Z0-9_]/g, "")}.json`);

export function newBusiness(): BusinessState {
  const now = new Date().toISOString();
  return {
    id: shortId("biz"),
    createdAt: now,
    updatedAt: now,
    status: "onboarding",
    draft: {},
    profiles: [],
    plans: [],
    changeRequests: [],
    chain: { accounts: {}, txs: [] },
    ledger: [],
    card: { frozen: false, txns: [], unbilled: { google: 0, meta: 0 }, threshold: { google: usd(50), meta: usd(25) } },
    campaigns: [],
    creatives: [],
    facts: [],
    actions: [],
    decisions: [],
    reconciliations: [],
    ownerTasks: [],
    execution: [],
    reports: [],
    chat: [],
    day: 0,
    opsAccrued: 0,
    llm: { provider: "house", calls: 0 },
  };
}

export function saveBusiness(state: BusinessState): void {
  state.updatedAt = new Date().toISOString();
  const f = file(state.id);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, f);
}

export function loadBusiness(id: string): BusinessState | null {
  try {
    return JSON.parse(fs.readFileSync(file(id), "utf8")) as BusinessState;
  } catch {
    return null;
  }
}

export function listBusinesses(): BusinessState[] {
  const dir = path.join(dataDir(), "businesses");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadBusiness(f.replace(/\.json$/, "")))
    .filter((b): b is BusinessState => !!b)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const locks = new Map<string, Promise<unknown>>();
/** Serialise all work on one business (the same role as an Inngest concurrency key). */
export async function withBusiness<T>(id: string, fn: (state: BusinessState) => Promise<T> | T): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev
    .catch(() => undefined)
    .then(async () => {
      const state = loadBusiness(id);
      if (!state) throw new Error("Business not found");
      const out = await fn(state);
      saveBusiness(state);
      return out;
    });
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}
