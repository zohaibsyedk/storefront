import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Set E2E_BASE_URL to run against a server that is already up (for example the dev server).
const external = process.env.E2E_BASE_URL;
const dataDir = path.join(os.tmpdir(), `storefront-e2e-${Date.now()}`);

export default defineConfig({
  testDir: "./e2e",
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: external ?? "http://localhost:3100", trace: "retain-on-failure" },
  webServer: external ? undefined : {
    command: "npm run build -w web && npm run start -w web -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { STOREFRONT_DATA_DIR: dataDir, STOREFRONT_LLM: "house" },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
