/**
 * Classroom creation tutorial (#68).
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`).
 *
 * Covers: the dashboard "New classroom" entry point, the classroom-teacher-add
 * tour on the create form, picking a lead teacher, and the next-steps tour and
 * empty-state CTAs on the freshly created classroom, including the challenge
 * wizard opening with that classroom preselected.
 */
import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { COORDINATOR, login, skipTours, walkTour } from "./helpers/onboarding";
import { makeShooter } from "./helpers/screenshots";
import { DEV_DATABASE_URL } from "./helpers/seed";
const TITLE_PREFIX = "E2E onboarding classroom";

test.afterAll(async () => {
  const sql = postgres(DEV_DATABASE_URL, { max: 1 });
  try {
    await sql`DELETE FROM classroom WHERE title LIKE ${`${TITLE_PREFIX}%`}`;
  } finally {
    await sql.end();
  }
});

test("coordinator creates a classroom guided by the tutorial", async ({
  page,
}, testInfo) => {
  const shot = makeShooter(page, testInfo);
  await skipTours(page, ["coordinator-onboarding"]);
  await login(page, COORDINATOR);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: /New classroom/ }).click();
  await page.waitForURL("**/classrooms/create");

  await expect(page.locator(".driver-popover")).toBeVisible();
  await shot("create-tour-start");
  await walkTour(page, [
    "Create a classroom",
    "Name the classroom",
    "Choose the lead teacher",
    "Create and continue",
  ]);

  const title = `${TITLE_PREFIX} ${Date.now()}`;
  await page.getByPlaceholder(/Programming I/).fill(title);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Prof\. Demo/ }).click();
  await shot("create-form-filled");
  await page.getByRole("button", { name: "Create classroom" }).click();

  await page.waitForURL(/\/classrooms\/(?!create)[^/]+$/);
  const classroomId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByText("Prof. Prof. Demo")).toBeVisible();

  // Empty classroom: the next-steps tour auto-starts for managers.
  await expect(page.locator(".driver-popover")).toBeVisible();
  await walkTour(page, ["Lead teacher", "Enroll students", "Assign challenges"]);

  await expect(
    page.getByText(
      "Pick an organization member in the selector above to enroll them."
    )
  ).toBeVisible();
  const createChallenge = page.getByRole("link", { name: "Create a challenge" });
  await expect(createChallenge).toHaveAttribute(
    "href",
    `/create?classroomId=${classroomId}`
  );
  await shot("classroom-next-steps");

  // The wizard opens with this classroom already selected.
  await createChallenge.click();
  await page.waitForURL(/\/create\?classroomId=/);
  await expect(page.getByRole("combobox").filter({ hasText: title })).toBeVisible();
  await shot("challenge-wizard-prefilled");
});
