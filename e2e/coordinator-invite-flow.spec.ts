/**
 * Coordinator invite flow (#69).
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`).
 *
 * Covers: the Team nav entry, the invite-flow tutorial, sending an invitation
 * with a role capped at the coordinator's own, and cancelling it. Also checks
 * that teachers cannot reach the screen.
 */
import { test, expect } from "@playwright/test";
import { PROFESSOR } from "./helpers/seed";
import { COORDINATOR, login, skipTours, walkTour } from "./helpers/onboarding";
import { makeShooter } from "./helpers/screenshots";

test.describe("Coordinator invite flow", () => {
  test("coordinator follows the tutorial, invites a teacher and cancels it", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    await skipTours(page, ["coordinator-onboarding"]);
    await login(page, COORDINATOR);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Team", exact: true }).click();
    await page.waitForURL("**/team");

    // First visit auto-starts the invite-flow tour.
    await expect(page.locator(".driver-popover")).toBeVisible();
    await shot("invite-tour-start");
    await walkTour(page, [
      "Bringing people in",
      "Email invitation",
      "Email domain (admin only)",
      "Bulk import (admin only)",
      "Pick the right role",
      "Send an invitation",
      "Track pending invitations",
    ]);

    await expect(
      page.getByRole("heading", { name: "Team and invitations" })
    ).toBeVisible();
    await shot("team-page");

    const email = `e2e-invite-${Date.now()}@school.test`;
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill(email);

    // Coordinators are not offered the admin role.
    await dialog.getByRole("combobox").click();
    await expect(page.getByRole("option", { name: "Teacher" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Administrator" })).toHaveCount(
      0
    );
    await page.getByRole("option", { name: "Teacher" }).click();
    await shot("invite-dialog");
    await dialog.getByRole("button", { name: "Send invitation" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await shot("invitation-pending");

    await page
      .getByRole("button", { name: `Cancel invitation for ${email}` })
      .click();
    await page.getByRole("button", { name: "Yes, cancel" }).click();
    await expect(row).toHaveCount(0);
  });

  test("teachers do not get the team screen", async ({ page }) => {
    await login(page, PROFESSOR);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Team", exact: true })).toHaveCount(
      0
    );

    await page.goto("/team");
    await expect(
      page.getByRole("heading", {
        name: "Invitations are managed by coordinators",
      })
    ).toBeVisible();
  });
});
