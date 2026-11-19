import { expect, test } from "@playwright/test";

/** The MVP definition of done, driven through the real UI. */
test("bakery: onboard, resume, plan, change, approve, launch, 30 days, kill switch", async ({ page }) => {
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const next = async () => {
    await noOverflow();
    await page.getByRole("button", { name: "Next", exact: true }).click();
  };
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my business" }).click();
  await expect(page.getByRole("heading", { name: "What would you like us to set up?" })).toBeVisible();

  // Step 1: website + Google on (defaults), Apple off.
  await expect(page.getByRole("button", { name: /^A website/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Apple Maps listing/ })).toHaveAttribute("aria-pressed", "false");
  await next();

  // Step 2: Next is never disabled; it says what is missing instead.
  await expect(page.getByRole("heading", { name: "Tell us about the business" })).toBeVisible();
  await next();
  await expect(page.getByText(/Add your business name/)).toBeVisible();
  await page.getByRole("textbox", { name: "Business name" }).fill("Marigold Bakehouse");
  await page.getByLabel("What kind of business is it?").selectOption("bakery");
  await page.getByRole("textbox", { name: "Describe it in a sentence or two" }).fill("Sourdough, morning buns and celebration cakes, baked from scratch on Alder Street every day.");
  await next();

  // Step 3: paste-a-menu import.
  await page.getByRole("button", { name: "Paste a menu or price list" }).click();
  await page.getByRole("textbox", { name: "Paste it here, one item per line" }).fill("Country sourdough $9\nMorning bun $4.50\nCelebration cakes from $65");
  await page.getByRole("button", { name: "Turn into items" }).click();
  await expect(page.getByLabel("Item 3")).toHaveValue("Celebration cakes");
  await next();

  // Step 4, then quit halfway and come back.
  await page.getByRole("textbox", { name: "Street address" }).fill("214 Alder Street");
  await page.getByRole("textbox", { name: "City" }).fill("Portland");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const url = page.url();
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Where are you, and when are you open?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Street address" })).toHaveValue("214 Alder Street");
  await next();

  await page.getByRole("textbox", { name: "Phone number for customers" }).fill("(503) 555-0142");
  await next();
  await page.getByRole("button", { name: "Skip for now" }).click(); // photos are optional

  await page.getByRole("button", { name: "25-34" }).click();
  await page.getByRole("button", { name: "35-44" }).click();
  await next();

  await page.getByRole("textbox", { name: "Total budget in dollars" }).fill("1500");
  await page.getByRole("radio", { name: "Visits to the shop" }).click();
  await expect(page.getByText("About $13.33 a day for 90 days")).toBeVisible();
  await next();

  await expect(page.getByText("8 of 8 sections complete")).toBeVisible();
  await page.getByRole("button", { name: "Draft my plan" }).click();

  // Plan review.
  await expect(page.getByRole("heading", { name: "Your launch plan" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("$1,200.00").first()).toBeVisible();
  const domains = page.getByRole("radiogroup").filter({ has: page.getByText("a year").first() }).getByRole("radio");
  expect(await domains.count()).toBeGreaterThanOrEqual(5);
  await expect(page.frameLocator('iframe[title="Website preview"]').getByRole("heading", { level: 1 })).toContainText("Alder Street");

  // One change request, with a diff.
  await page.getByRole("button", { name: "Ask for a change" }).first().click();
  await page.getByRole("textbox", { name: "What should be different?" }).fill("Focus on celebration cakes and use the second domain");
  await page.getByRole("button", { name: "Revise the plan" }).click();
  await expect(page.getByText(/what changed between version 1 and 2/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Website: Domain")).toBeVisible();

  await page.getByRole("button", { name: "Approve version 2" }).click();
  await expect(page.getByRole("heading", { name: "Pay and launch" })).toBeVisible();
  await page.getByRole("button", { name: /Pay \$[\d,.]+ and launch/ }).click();
  await expect(page.getByRole("heading", { name: "Launched" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Go to your dashboard" }).click();

  // 30 simulated days.
  await page.getByRole("button", { name: "Run 30 days" }).click();
  await expect(page.getByText("Day 30 of 90")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Money check passed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spend against budget" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chosen for you this week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Which ads are working" })).toBeVisible();

  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.getByText(/Moved \$[\d.]+ a day/).first()).toBeVisible();

  // Kill switch.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Stop everything" }).click();
  await page.getByRole("button", { name: "Yes, stop everything" }).click();
  await expect(page.getByRole("heading", { name: "Everything is stopped" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("$0.00").first()).toBeVisible();
  await expect(page.getByText("The card is frozen.")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
