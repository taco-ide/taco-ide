/**
 * Accept-invitation flow (issue #126): the link in the invitation email
 * (`/auth/accept-invitation?id=...`) must lead a new or existing user into
 * the organization with the invited role.
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`).
 * Fixtures are created in throwaway organizations and removed afterwards.
 */
import { test, expect, type Page } from "@playwright/test";
import { PROFESSOR, STUDENT } from "./helpers/seed";
import {
  cleanupInvitationFixtures,
  createE2eOrganization,
  createInvitation,
  findMembershipRole,
} from "./helpers/invitations";
import { makeShooter } from "./helpers/screenshots";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
const runId = Date.now();
const ORG_NAME = `E2E Invite School ${runId}`;
const NEW_USER_EMAIL = `invited-${runId}@e2e-invite.test`;

let organizationId: string;

test.beforeAll(async () => {
  organizationId = await createE2eOrganization(ORG_NAME);
});

test.afterAll(async () => {
  await cleanupInvitationFixtures({
    organizationIds: organizationId ? [organizationId] : [],
    userEmails: [NEW_USER_EMAIL],
  });
});

/** The signed-in user's active organization and role, as the app sees them. */
async function currentMembership(page: Page) {
  const response = await page.request.get(`${API_URL}/v1/users/me`);
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return {
    organizationId: body.data.activeOrganizationId as string | null,
    role: body.data.role as string | null,
  };
}

async function login(page: Page, email: string, password: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("Accept invitation", () => {
  test("new user signs up from the invitation and joins with the invited role", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    const invitationId = await createInvitation({
      organizationId,
      email: NEW_USER_EMAIL,
      role: "teacher",
    });

    await page.goto(`/auth/accept-invitation?id=${invitationId}`);
    await expect(page.getByRole("heading", { name: "You're invited" })).toBeVisible();
    await expect(page.getByText(ORG_NAME).first()).toBeVisible();
    await expect(page.getByText("Teacher", { exact: true })).toBeVisible();
    await shot("invitation-signed-out");

    await page.getByRole("link", { name: "Create an account" }).click();
    await page.waitForURL(/\/auth\/signup/);
    await expect(page.getByLabel("Email")).toHaveValue(NEW_USER_EMAIL);

    await page.getByLabel("Full Name").fill("Invited Teacher");
    await page.getByLabel("Password", { exact: true }).fill("Teste123!@");
    await page.getByLabel("Confirm Password").fill("Teste123!@");
    await shot("signup-prefilled");
    await page.getByRole("button", { name: "Sign up" }).click();

    // Back on the invitation, now signed in as the invited email.
    await page.waitForURL(/\/auth\/accept-invitation\?id=/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
    await shot("invitation-signed-in");

    await page.getByRole("button", { name: "Accept invitation" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    // The dashboard header shows the active organization and role.
    await expect(page.getByText(`Teacher · ${ORG_NAME}`)).toBeVisible({
      timeout: 15_000,
    });
    await shot("dashboard-after-accept");

    expect(await findMembershipRole(NEW_USER_EMAIL, organizationId)).toBe("teacher");
    expect(await currentMembership(page)).toEqual({ organizationId, role: "teacher" });

    // Reopening the link explains that it was already used.
    await page.goto(`/auth/accept-invitation?id=${invitationId}`);
    await expect(
      page.getByRole("heading", { name: "Invitation already accepted" })
    ).toBeVisible();
  });

  test("existing user signs in from the invitation and accepts", async ({
    page,
  }) => {
    const invitationId = await createInvitation({
      organizationId,
      email: PROFESSOR.email,
      role: "coordinator",
    });

    await page.goto(`/auth/accept-invitation?id=${invitationId}`);
    await page.getByRole("link", { name: "Sign in to accept" }).click();
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByLabel(/email/i)).toHaveValue(PROFESSOR.email);
    await login(page, PROFESSOR.email, PROFESSOR.password);

    await page.waitForURL(/\/auth\/accept-invitation\?id=/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    expect(await findMembershipRole(PROFESSOR.email, organizationId)).toBe(
      "coordinator"
    );
    expect(await currentMembership(page)).toEqual({
      organizationId,
      role: "coordinator",
    });
  });

  test("signed-in user with another email sees the wrong-account state", async ({
    page,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);
    const invitationId = await createInvitation({
      organizationId,
      email: `someone-else-${runId}@e2e-invite.test`,
    });

    await page.goto("/auth/login");
    await login(page, STUDENT.email, STUDENT.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));

    await page.goto(`/auth/accept-invitation?id=${invitationId}`);
    await expect(page.getByRole("heading", { name: "Wrong account" })).toBeVisible();
    await expect(page.getByText(STUDENT.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
    await shot("wrong-account");
  });

  test("expired, canceled and unknown invitations explain what happened", async ({
    page,
  }) => {
    const expiredId = await createInvitation({
      organizationId,
      email: `expired-${runId}@e2e-invite.test`,
      expired: true,
    });
    const canceledId = await createInvitation({
      organizationId,
      email: `canceled-${runId}@e2e-invite.test`,
      status: "canceled",
    });

    await page.goto(`/auth/accept-invitation?id=${expiredId}`);
    await expect(page.getByRole("heading", { name: "Invitation expired" })).toBeVisible();

    await page.goto(`/auth/accept-invitation?id=${canceledId}`);
    await expect(page.getByRole("heading", { name: "Invitation canceled" })).toBeVisible();

    await page.goto("/auth/accept-invitation?id=does-not-exist");
    await expect(page.getByRole("heading", { name: "Invitation not found" })).toBeVisible();
  });

  test("login ignores redirects to other sites", async ({ page }) => {
    await page.goto("/auth/login?redirect=//example.com/phish");
    await login(page, STUDENT.email, STUDENT.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
      timeout: 30_000,
    });
    expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL!).host);
  });
});
