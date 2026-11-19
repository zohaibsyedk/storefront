import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@storefront/agent";

type Ctx = { params: Promise<{ id: string; file: string }> };
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: Ctx) {
  const { id, file } = await params;
  const safeId = id.replace(/[^a-zA-Z0-9_]/g, "");
  const safeFile = file.replace(/[^a-zA-Z0-9_.]/g, "");
  const ext = safeFile.split(".").pop() ?? "";
  const full = path.join(dataDir(), "uploads", safeId, safeFile);
  if (!MIME[ext] || !fs.existsSync(full)) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(full)), { headers: { "content-type": MIME[ext], "cache-control": "private, max-age=3600" } });
}
