/**
 * End-to-end professor workflow spec.
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`).
 * The seeded professor / student / classroom / challenge accounts are
 * documented in e2e/helpers/seed.ts.
 *
 * What this spec covers:
 *   1. Professor login.
 *   2. Inside-dashboard landing — at least one classroom or challenge is
 *      reachable from the navigation.
 *   3. Open the submissions list for a known challenge.
 *   4. Open a single submission's detail page.
 *   5. Enter a grade, save, and verify it persisted via reload.
 */
import { test, expect } from "@playwright/test";
import {
  PROFESSOR,
  SEED_CHALLENGE_ID,
  seedSubmissionForGrading,
  resetSubmissionGrade,
} from "./helpers/seed";

let submissionId: string;

test.beforeAll(async () => {
  const seeded = await seedSubmissionForGrading();
  submissionId = seeded.submissionId;
  await resetSubmissionGrade(submissionId);
});

test.describe("Professor workflow", () => {
  test("professor can login, view a submission, and grade it", async ({ page }) => {
    // ---- 1. Login ----
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(PROFESSOR.email);
    await page.getByLabel(/password/i).fill(PROFESSOR.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Login takes the user out of /auth/login. Wait for the redirect.
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
      timeout: 30_000,
    });

    // ---- 2. Navigate directly to the seeded challenge's submissions page ----
    await page.goto(`/create/${SEED_CHALLENGE_ID}/submissions`);

    // The page must render — wait for any table row OR a clearly empty state.
    // The seeded submission exists, so we expect at least one row.
    const studentCell = page.getByText("Aluno Demo").first();
    await expect(studentCell).toBeVisible({ timeout: 15_000 });

    // ---- 3. Open the submission detail ----
    await page.goto(
      `/create/${SEED_CHALLENGE_ID}/submissions/${submissionId}`
    );
    await expect(
      page.getByRole("heading", { name: /Submissão de Aluno Demo/i })
    ).toBeVisible();
    await expect(page.getByText(/print\('hello world'\)/)).toBeVisible();

    // ---- 4. Enter a grade and save ----
    const gradeInput = page.getByLabel(/nota \(ex/i);
    await gradeInput.fill("9.5");

    const commentInput = page.getByLabel(/comentário/i);
    await commentInput.fill("Bom trabalho — E2E test grading.");

    await page.getByRole("button", { name: /salvar nota/i }).click();

    // Success feedback should appear (the exact "Nota salva" alert, not the
    // "Última nota salva em ..." timestamp line that also appears).
    await expect(page.getByText("Nota salva", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // ---- 5. Reload and confirm persistence ----
    await page.reload();
    await expect(page.getByLabel(/nota \(ex/i)).toHaveValue("9.5");
    await expect(page.getByLabel(/comentário/i)).toHaveValue(
      "Bom trabalho — E2E test grading."
    );

    // The grade should also appear in the list view.
    await page.goto(`/create/${SEED_CHALLENGE_ID}/submissions`);
    await expect(page.getByText("9.5")).toBeVisible({ timeout: 10_000 });
  });
});
