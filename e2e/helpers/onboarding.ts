/**
 * Helpers for the coordinator onboarding specs (team invitations and
 * classroom creation tutorials).
 */
import { expect, type Page } from "@playwright/test";

export const COORDINATOR = {
  email: "coordenador@taco-demo.local",
  password: "Teste123!@",
};

/**
 * Marks driver.js tours as already seen (see apps/web/src/hooks/useTutorial.ts)
 * so they do not overlay the page. Must run before the first navigation.
 */
export async function skipTours(page: Page, ids: string[]) {
  await page.addInitScript((tourIds: string[]) => {
    for (const id of tourIds) {
      window.localStorage.setItem(`taco-tutorial:${id}`, "1");
    }
  }, ids);
}

export async function login(
  page: Page,
  { email, password }: { email: string; password: string }
) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
    timeout: 30_000,
  });
}

/**
 * Walks an open driver.js tour, asserting each popover title in order, and
 * closes it with the final "done" button.
 */
export async function walkTour(page: Page, titles: string[]) {
  const popover = page.locator(".driver-popover");
  for (const [index, title] of titles.entries()) {
    await expect(popover.locator(".driver-popover-title")).toHaveText(title);
    await popover.locator(".driver-popover-next-btn").click();
    if (index === titles.length - 1) {
      await expect(popover).toBeHidden();
    }
  }
}
