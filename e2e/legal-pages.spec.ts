/**
 * Public Terms of Use / Privacy Notice pages (issue #27).
 *
 * What this tests:
 *   1. The auth layout's legal links lead to real, public pages (no "#").
 *   2. /terms and /privacy render for anonymous visitors (no login redirect)
 *      and are clearly marked as drafts pending legal review.
 *   3. Both pages are translated (PT-BR via the locale cookie).
 *   4. The in-app footer no longer points to the missing "#recursos" anchor
 *      and links to both legal pages.
 *   5. Only /terms and /privacy themselves are public: look-alike paths such
 *      as /privacy-foo still require a login.
 */
import { test, expect } from "@playwright/test";
import { LOCALE_COOKIE } from "../apps/web/src/i18n/config";
import { PROFESSOR } from "./helpers/seed";
import { makeShooter } from "./helpers/screenshots";

test.describe("Legal pages", () => {
  test("auth layout links open the public terms and privacy pages", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);

    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Terms of Use" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Terms of Use" }),
    ).toBeVisible();
    await expect(page.getByText(/draft/i).first()).toBeVisible();
    await shot("terms-en");

    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Privacy Notice" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy Notice" }),
    ).toBeVisible();
    await expect(page.getByText(/LGPD/).first()).toBeVisible();
    await shot("privacy-en");
  });

  test("only the exact legal paths are public", async ({ page }) => {
    for (const path of ["/privacy-foo", "/termsX"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    }
  });

  test("legal pages are translated to Portuguese", async ({
    page,
    context,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    const url = new URL(testInfo.project.use.baseURL ?? "http://localhost:4001");
    await context.addCookies([
      {
        name: LOCALE_COOKIE,
        value: "pt",
        domain: url.hostname,
        path: "/",
      },
    ]);

    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Aviso de Privacidade" }),
    ).toBeVisible();
    await shot("privacy-pt");

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { level: 1, name: "Termos de Uso" }),
    ).toBeVisible();
    await shot("terms-pt");
  });

  test("in-app footer links to the legal pages", async ({ page }, testInfo) => {
    const shot = makeShooter(page, testInfo);

    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(PROFESSOR.email);
    await page.getByLabel(/password/i).fill(PROFESSOR.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), {
      timeout: 30_000,
    });

    const footer = page.locator("footer");
    await expect(footer.locator('a[href="#recursos"]')).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await shot("inside-footer");

    // Logged-in users can still open the public pages.
    await footer.getByRole("link", { name: "Terms" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Terms of Use" }),
    ).toBeVisible();
  });
});
