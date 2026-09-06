import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.TEST_PRODUCTION
      ? "npm run preview -- --host 127.0.0.1 --port 4173"
      : "npm run dev -- --host 127.0.0.1",
    url: process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
