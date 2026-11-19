import fs from "node:fs";
import path from "node:path";
import { shortId } from "@storefront/core";
import { dataDir, loadBusiness } from "@storefront/agent";

type Ctx = { params: Promise<{ id: string }> };
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Stores an uploaded photo and returns its URL. The wizard saves the photo list itself (with tags). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!loadBusiness(id)) return Response.json({ error: "We could not find that business." }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No photo received." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return Response.json({ error: "That photo is over 12 MB. Try a smaller one." }, { status: 400 });
  const photoId = shortId("ph");
  const dir = path.join(dataDir(), "uploads", id.replace(/[^a-zA-Z0-9_]/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${photoId}.${ext}`), Buffer.from(await file.arrayBuffer()));
  return Response.json({ id: photoId, url: `/api/photos/${id}/${photoId}.${ext}` });
}
