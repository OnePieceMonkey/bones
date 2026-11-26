import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  updateSnapshots: "none", // a missing reference fails (R21.7)
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, threshold: 0.2, animations: "disabled" },
  },
  use: {
    baseURL: "http://127.0.0.1:5202",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    colorScheme: "dark",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /(reference-1600|no-scroll|flat-contrast)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-1600",
      testMatch: /(reference-1600|no-scroll|flat-contrast)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 900 },
        reducedMotion: "reduce",
        colorScheme: "dark",
      },
    },
  ],
  webServer: {
    // Serves the freshly built production bundle, so the e2e never runs against a stale dist.
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 5202 --strictPort",
    url: "http://127.0.0.1:5202",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: { LIVE_EXTRACTION: "off", CASE_FILES_E2E: "1" },
  },
  reporter: [["html", { open: "never" }], ["list"]],
});
