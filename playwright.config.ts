import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "gameplay",
      testIgnore: ["**/production-smoke.spec.ts", "**/grid-render-screenshot.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "grid-visual",
      testMatch: "**/grid-render-screenshot.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 512, height: 384 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npx vite --config vite.playwright.config.ts",
    url: "http://127.0.0.1:4173/__test__/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
