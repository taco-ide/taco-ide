/**
 * Playwright config for end-to-end tests against the running TACO-IDE
 * dev stack (API on :4000, web on :4001).
 *
 * The `webServer` array starts both apps with a single `npm run dev` from
 * the repo root and waits for the web app to respond on port 4001.
 *
 * Tests assume the dev database has been seeded with `cd packages/infra
 * && npm run db:seed:dev` (creates the professor@taco-demo.local /
 * aluno@taco-demo.local accounts with password Teste123!@).
 */
import { defineConfig, devices } from "@playwright/test";

const FRONTEND = process.env.E2E_FRONTEND_URL ?? "http://localhost:4001";
const API = process.env.E2E_API_URL ?? "http://localhost:4000";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev --workspace=apps/api",
      url: `${API}/docs/json`,
      timeout: 120_000,
      reuseExistingServer,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm run dev --workspace=apps/web",
      url: FRONTEND,
      timeout: 180_000,
      reuseExistingServer,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
