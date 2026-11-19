import { listBusinesses, newBusiness, saveBusiness } from "@storefront/agent";

export async function GET() {
  const list = listBusinesses().map((b) => ({ id: b.id, name: b.draft.basics?.name ?? b.profiles.at(-1)?.basics.name ?? "Unnamed business", status: b.status, updatedAt: b.updatedAt, step: b.draft.lastStep ?? 0, day: b.day }));
  return Response.json({ businesses: list });
}

export async function POST() {
  const b = newBusiness();
  saveBusiness(b);
  return Response.json({ id: b.id });
}
