/**
 * Teaching assistant management (issue #21).
 *
 * Preconditions: dev DB seeded (`cd packages/infra && npm run db:seed:dev`).
 *
 * Covers:
 *   1. Professor (teacher) sees the list with the organization default badge.
 *   2. Creates an assistant, renames it, and the wizard dropdown offers it
 *      once a classroom is selected.
 *   3. Cannot edit the organization default (coordinator-only).
 *   4. Deactivates their own assistant; the coordinator deletes it.
 */
import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { PROFESSOR } from "./helpers/seed";
import { makeShooter } from "./helpers/screenshots";

const COORDINATOR = {
  email: "coordenador@taco-demo.local",
  password: PROFESSOR.password,
};
const ALIAS_PREFIX = "E2E Tutor";
const alias = `${ALIAS_PREFIX} ${Date.now().toString(36)}`;

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
    timeout: 30_000,
  });
}

const card = (page: Page, name: string) =>
  page
    .locator("div.rounded-xl, [class*='card']")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .first();

test.afterAll(async () => {
  // Soft-delete anything a failed run left behind.
  const sql = postgres(
    process.env.DATABASE_URL ??
      "postgresql://dbuser:dbpass@localhost:5490/taco_dev",
    { max: 1 }
  );
  try {
    await sql`
      update teaching_assistant
         set deleted_at = now(), is_active = false
       where alias like ${ALIAS_PREFIX + " %"} and deleted_at is null`;
  } finally {
    await sql.end();
  }
});

test.describe("Teaching assistants", () => {
  test("teacher manages own assistant; coordinator deletes it", async ({
    page,
    browser,
  }, testInfo) => {
    const shot = makeShooter(page, testInfo);

    // ---- 1. List ----
    await login(page, PROFESSOR);
    await page.goto("/teaching-assistants");
    await expect(
      page.getByRole("heading", { name: "Teaching assistants" })
    ).toBeVisible();
    const seeded = card(page, "TACO Assistant");
    await expect(seeded.getByText("Organization default")).toBeVisible();
    await shot("list-with-default");

    // ---- 2. Create ----
    await page.getByRole("button", { name: "New assistant" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(alias);
    await dialog.getByLabel(/^Instructions/).fill("Ask guiding questions.");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Teaching assistant created.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: alias, exact: true })
    ).toBeVisible();
    await shot("created");

    // ---- 3. Rename (description) without touching parameters ----
    await page.getByRole("button", { name: `Edit ${alias}` }).click();
    await dialog.getByLabel(/^Description/).fill("Updated by E2E");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Teaching assistant updated.")).toBeVisible();
    await expect(card(page, alias).getByText("Updated by E2E")).toBeVisible();

    // ---- 4. The default is coordinator-only ----
    await page.getByRole("button", { name: "Edit TACO Assistant" }).click();
    await dialog.getByLabel(/^Description/).fill("Teacher rewrite");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText(/only coordinators and admins can change/i)
    ).toBeVisible();
    await shot("default-refused");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // ---- 5. Wizard dropdown offers the classroom organization's assistants ----
    await page.goto("/create");
    await expect(page.getByText("Problem Title")).toBeVisible();
    const taSelect = page.getByLabel("Teaching assistant");
    await expect(taSelect).toBeDisabled();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await expect(taSelect).toBeEnabled();
    await taSelect.click();
    await expect(page.getByRole("option", { name: alias })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Organization default" })
    ).toBeVisible();
    await shot("wizard-dropdown");
    await page.keyboard.press("Escape");

    // ---- 6. Deactivate own assistant ----
    await page.goto("/teaching-assistants");
    await page.getByRole("button", { name: `Edit ${alias}` }).click();
    await dialog.getByLabel(/^Active/).uncheck();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Teaching assistant updated.")).toBeVisible();
    await expect(card(page, alias).getByText("Inactive")).toBeVisible();
    // Teachers cannot delete.
    await expect(
      page.getByRole("button", { name: `Delete ${alias}` })
    ).toHaveCount(0);
    await shot("deactivated");

    // ---- 7. Coordinator deletes it ----
    const context = await browser.newContext();
    const coord = await context.newPage();
    try {
      await login(coord, COORDINATOR);
      await coord.goto("/teaching-assistants");
      await coord.getByRole("button", { name: `Delete ${alias}` }).click();
      await coord
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();
      await expect(coord.getByText("Teaching assistant deleted.")).toBeVisible();
      await expect(
        coord.getByRole("heading", { name: alias, exact: true })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
