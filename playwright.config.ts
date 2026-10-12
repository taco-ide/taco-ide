/**
 * Playwright config for end-to-end tests against the running TACO-IDE
 * local stack (API on :4000, web on :4001 by default).
 * E2E_API_URL and E2E_FRONTEND_URL also configure the spawned server ports.
 * CI starts the production build; local runs start development servers.
 *
 * Tests assume the dev database has been seeded with `cd packages/infra
 * && npm run db:seed:dev` (creates the professor@taco-demo.local /
 * aluno@taco-demo.local accounts with password Teste123!@).
 */
import { defineConfig, devices } from "@playwright/test";
import { LOCALE_COOKIE } from "./apps/web/src/i18n/config";

const FRONTEND = process.env.E2E_FRONTEND_URL ?? "http://localhost:4001";
const API = process.env.E2E_API_URL ?? "http://localhost:4000";
const frontendUrl = new URL(FRONTEND);
const apiUrl = new URL(API);
const apiPort = apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80");
const frontendPort =
  frontendUrl.port || (frontendUrl.protocol === "https:" ? "443" : "80");
const useProductionBuild = process.env.E2E_USE_BUILD === "true";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [[process.env.CI ? "github" : "list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND,
    // Keep UI assertions deterministic even if the product default changes.
    storageState: {
      cookies: [
        {
          name: LOCALE_COOKIE,
          value: "en",
          domain: frontendUrl.hostname,
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: frontendUrl.protocol === "https:",
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
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
      command: useProductionBuild
        ? "npm exec --workspace=apps/api -- tsx dist/index.js"
        : "npm run dev --workspace=apps/api",
      env: {
        PORT: apiPort,
        BETTER_AUTH_URL: API,
        FRONTEND_URL: FRONTEND,
      },
      url: `${API}/v1/status`,
      timeout: 120_000,
      reuseExistingServer,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: useProductionBuild
        ? `npm exec --workspace=apps/web -- next start --port ${frontendPort}`
        : `npm exec --workspace=apps/web -- next dev --port ${frontendPort}`,
      env: { NEXT_PUBLIC_API_URL: API },
      url: FRONTEND,
      timeout: 180_000,
      reuseExistingServer,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
