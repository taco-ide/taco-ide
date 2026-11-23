/**
 * First-access screen for users without an active organization (#66).
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`);
 * the seeded professor is used as the inviter of test invitations. Every
 * test creates its own user and organizations (see helpers/first-access.ts)
 * and deletes them afterwards.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  createFirstAccessUser,
  type FirstAccessFixtures,
} from "./helpers/first-access";
import { makeShooter } from "./helpers/screenshots";

const ACCESS_STATUS = "**/v1/users/me/access-status";
const NEW_USER_TITLE = "Welcome! You are not in an organization yet";
const INACTIVE_TITLE = "Your organization is inactive";

let fixtures: FirstAccessFixtures;

test.beforeEach(async () => {
  fixtures = await createFirstAccessUser();
});

test.afterEach(async () => {
  await fixtures.cleanup();
});

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(fixtures.user.email);
  await page.getByLabel(/password/i).fill(fixtures.user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
    timeout: 30_000,
  });
}

function heading(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true });
}

test.describe("First-access screen", () => {
  test("new user sees a pending invitation and coordinator guidance", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    const org = await fixtures.createOrganization();
    const invitationId = await fixtures.createInvitation(org.id, "teacher");

    await login(page);

    await expect(heading(page, NEW_USER_TITLE)).toBeVisible();
    await expect(page.getByText(fixtures.user.email)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You have a pending invitation" }),
    ).toBeVisible();
    const invitation = page.getByRole("listitem").filter({
      hasText: org.name,
    });
    await expect(invitation).toContainText("Role: Teacher");
    await expect(
      invitation.getByRole("link", { name: "Review invitation" }),
    ).toHaveAttribute(
      "href",
      `/auth/accept-invitation?id=${encodeURIComponent(invitationId)}`,
    );
    // Only coordinators and institution administrators can invite people.
    await expect(
      page.getByText(/ask your coordinator or institution administrator/i),
    ).toBeVisible();
    await expect(page.getByText(/teacher to invite/i)).toHaveCount(0);
    await shot("new-user-with-invitation");
  });

  test("user of a deactivated organization sees the inactive copy, never the new-user copy", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    const org = await fixtures.createOrganization({ isActive: false });
    await fixtures.addMembership(org.id);

    // Hold the access-status response so the loading state is observable.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(ACCESS_STATUS, async (route) => {
      await held;
      await route.continue();
    });

    await login(page);

    await expect(page.getByText("Checking your access...")).toBeVisible();
    await expect(heading(page, NEW_USER_TITLE)).toHaveCount(0);
    await expect(heading(page, INACTIVE_TITLE)).toHaveCount(0);
    await shot("loading");

    release();
    await expect(heading(page, INACTIVE_TITLE)).toBeVisible();
    await expect(heading(page, NEW_USER_TITLE)).toHaveCount(0);
    await shot("inactive-organization");
  });

  test("shows an error state when the access status cannot be loaded", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    await page.route(ACCESS_STATUS, (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );

    await login(page);

    await expect(heading(page, "We couldn't check your access")).toBeVisible({
      timeout: 20_000,
    });
    await expect(heading(page, NEW_USER_TITLE)).toHaveCount(0);
    await expect(heading(page, INACTIVE_TITLE)).toHaveCount(0);
    await shot("load-error");
  });

  test("check again reports pending access, errors, and lets the user in once added", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    await login(page);
    await expect(heading(page, NEW_USER_TITLE)).toBeVisible();

    const checkAgain = page.getByRole("button", {
      name: "Check my access again",
    });

    // Still no organization: the screen says so.
    await checkAgain.click();
    await expect(
      page.getByText(/still not linked to an organization/i),
    ).toBeVisible();
    await shot("still-pending");

    // A failing check is reported as an error, not as "still pending".
    await page.route(ACCESS_STATUS, (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );
    await checkAgain.click();
    await expect(
      page.getByText(/couldn't check your access right now/i),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/still not linked to an organization/i),
    ).toHaveCount(0);
    await shot("check-failed");
    await page.unroute(ACCESS_STATUS);

    // Once a membership exists, checking again opens the app.
    const org = await fixtures.createOrganization();
    await fixtures.addMembership(org.id);
    await checkAgain.click();
    await expect(heading(page, NEW_USER_TITLE)).toHaveCount(0);
    await expect(checkAgain).toHaveCount(0);
    await shot("access-granted");
  });
});
