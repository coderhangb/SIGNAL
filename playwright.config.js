import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/html", open: "never" }],
  ],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: "node tests/helpers/server.mjs",
        url: "http://127.0.0.1:4173/api/healthz",
        reuseExistingServer: false,
        timeout: 60000,
      },
});
