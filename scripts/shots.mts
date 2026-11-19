// Screenshot helper for visual review: npx tsx scripts/shots.mts <outDir> <path>[@mobile] ...
import { chromium } from "@playwright/test";
const [out, ...targets] = process.argv.slice(2);
const browser = await chromium.launch();
for (const t of targets) {
  const [path, mode] = t.split("@");
  const ctx = await browser.newContext({ viewport: mode === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const name = `${path.replace(/[^a-z0-9]+/gi, "_")}${mode ? "_" + mode : ""}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: process.env.FULL !== "0" });
  console.log(name, errors.length ? errors.slice(0, 3) : "ok");
  await ctx.close();
}
await browser.close();
