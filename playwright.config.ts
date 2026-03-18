import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Doitly dataflow E2E tests.
 * Tests run against the Vite dev server (http://localhost:5173).
 * All tests use guest mode (no Supabase auth) via localStorage seeding.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run all tests in each file in parallel */
  fullyParallel: false, // dataflow tests share state via localStorage – keep sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:5173",
    /* Run tests headless – swap to headed:true for debugging */
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    /* Each test gets a fresh browser context (isolated localStorage) */
    storageState: undefined,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Automatically start the Vite dev server before running tests */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
