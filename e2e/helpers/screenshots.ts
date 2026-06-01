/**
 * Screenshot helper for capturing PR evidence from e2e runs.
 *
 * Each captured shot is:
 *   1. Saved to test-results/screenshots/<test-slug>/NN-<name>.png so the
 *      files read in capture order and group by test. test-results/ is
 *      gitignored — these are artifacts to drag into the PR description /
 *      review comments, NOT committed files.
 *   2. Attached to the Playwright HTML report (testInfo.attach) so they also
 *      show up inline in `playwright-report/` for whoever runs the suite.
 *
 * Usage:
 *   test("...", async ({ page }, testInfo) => {
 *     const shot = makeShooter(page, testInfo);
 *     await shot("after-login");
 *   });
 */
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

const SCREENSHOT_ROOT = path.resolve(
  process.cwd(),
  "test-results",
  "screenshots"
);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Build a capture function bound to a single test. Call the returned function
 * at each milestone you want evidence for; shots are numbered automatically.
 *
 * @param page     the Playwright page under test
 * @param testInfo the per-test info (second arg of the test callback)
 * @param fullPage capture the full scrollable page instead of the viewport
 */
export function makeShooter(
  page: Page,
  testInfo: TestInfo,
  fullPage = false
): (name: string) => Promise<void> {
  // Group by the test title so shots from different tests don't collide.
  const dir = path.join(SCREENSHOT_ROOT, slugify(testInfo.title));
  let counter = 0;

  return async function shot(name: string): Promise<void> {
    counter += 1;
    const fileName = `${String(counter).padStart(2, "0")}-${slugify(name)}.png`;
    const filePath = path.join(dir, fileName);

    const buffer = await page.screenshot({ path: filePath, fullPage });
    await testInfo.attach(name, { body: buffer, contentType: "image/png" });
  };
}
