/**
 * Verifies the two-phase "Próximo" button on step 2 of the challenge wizard.
 *
 * What this tests:
 *   1. Login as professor.
 *   2. Open the create-challenge wizard at /create.
 *   3. Walk through step 0 (basic info) and step 1 (description).
 *   4. On step 2 (reference solutions):
 *      a. Button is labelled "Próximo" before save.
 *      b. Clicking it fires the create mutation and shows a green success alert.
 *      c. Button label changes to "Continuar para Knowledge Base".
 *      d. Clicking it again advances to step 3 (KB).
 *   5. Verify the professor lands on the KB step and not still on step 2.
 */
import { test, expect } from "@playwright/test";
import { PROFESSOR } from "./helpers/seed";
import { makeShooter } from "./helpers/screenshots";

test.describe("Challenge wizard — two-phase Próximo on step 2", () => {
  test("save shows success alert, second click advances to KB step", async ({ page }, testInfo) => {
    const shot = makeShooter(page, testInfo);

    // ---- 1. Login ----
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(PROFESSOR.email);
    await page.getByLabel(/password/i).fill(PROFESSOR.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
      timeout: 30_000,
    });

    // ---- 2. Open the create-challenge wizard ----
    await page.goto("/create");
    // Wait for the wizard to render
    await expect(page.getByText("Problem Title")).toBeVisible({ timeout: 10_000 });

    // ---- 3. Step 0 — fill basic info ----
    await page.getByPlaceholder(/quick sort/i).fill("E2E Two-Phase Wizard Test");

    // Difficulty
    await page.getByRole("combobox", { name: /select difficulty/i }).click().catch(async () => {
      // fallback: click first combobox
      await page.getByRole("combobox").first().click();
    });
    await page.getByRole("option").first().click();

    // Classroom — click "Turma" combobox (search for existing classroom)
    const classroomCombo = page.getByRole("combobox").last();
    await classroomCombo.click();
    await page.getByRole("option").first().click();

    // Advance to step 1
    await page.getByRole("button", { name: /^próximo$/i }).click();

    // ---- 4. Step 1 — description ----
    await expect(page.getByPlaceholder(/markdown/i)).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(/markdown/i).fill("Descrição de teste gerada pelo E2E.");

    // Advance to step 2
    await page.getByRole("button", { name: /^próximo$/i }).click();

    // ---- 5. Step 2 — reference solutions (first click = save) ----
    await expect(page.getByText(/soluções de referência/i).first()).toBeVisible({ timeout: 5_000 });

    // Button should say "Próximo" before save
    await expect(page.getByRole("button", { name: /^próximo$/i })).toBeVisible();

    // Click to trigger the create mutation
    await page.getByRole("button", { name: /^próximo$/i }).click();

    // Green success alert must appear — challenge saved, generation started
    await expect(page.getByText(/desafio salvo/i)).toBeVisible({ timeout: 20_000 });

    // Button label must have changed to "Continuar para Knowledge Base"
    await expect(
      page.getByRole("button", { name: /continuar para knowledge base/i })
    ).toBeVisible({ timeout: 5_000 });
    await shot("step2-saved-success-alert");

    // ---- 6. Second click — advance to KB step ----
    await page.getByRole("button", { name: /continuar para knowledge base/i }).click();

    // KB step renders a heading or content about "Knowledge Base"
    await expect(
      page.getByText(/knowledge base/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Sanity: "Continuar para Knowledge Base" button must be gone (we are now on step 3).
    await expect(page.getByRole("button", { name: /continuar para knowledge base/i })).not.toBeVisible();

    // Capture final state
    await shot("step3-knowledge-base");
  });
});
