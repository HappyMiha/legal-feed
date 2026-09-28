import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const bundled =
  "/home/happysnowman/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.AIX_TEST_URL || "http://127.0.0.1:4173",
    viewport: { width: 1366, height: 768 },
    headless: true,
    launchOptions: {
      executablePath:
        process.env.AIX_CHROMIUM_PATH ||
        (existsSync(bundled) ? bundled : undefined),
    },
    trace: "retain-on-failure",
  },
  webServer: process.env.AIX_TEST_URL
    ? undefined
    : {
        command: "npm run start -- --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 120000,
      },
  projects: [{ name: "chromium" }],
});
