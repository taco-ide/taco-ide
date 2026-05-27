---
name: pr-screenshots
description: Run the Playwright e2e suite, capture screenshots at asserted milestones, and embed them at the top of a PR description as visual proof of the change. Use when opening or updating a PR, or whenever the user asks for screenshot evidence on a PR.
---

# PR Screenshots

Turns a passing e2e run into visual proof at the top of the PR description: a
collapsible `<details>` block (with an `<h2>` summary) holding screenshots
captured during the test run, hosted on a per-PR secret gist.

## When to use

- Preparing a PR that changes UI, or asked to add "proof of the changes".
- Re-generating evidence after pushing UI fixes (the embed is idempotent —
  re-running replaces the old block and gist).

## Prerequisites

- Dev DB seeded: `cd packages/infra && npm run db:seed:dev` (creates the
  `professor@taco-demo.local` / `aluno@taco-demo.local` accounts).
- `gh` authenticated, `git`, `python3` available.
- A PR already exists for the current branch (`gh pr view` resolves it).
- **Permission**: pushing to a gist may be blocked by the auto-mode safety
  classifier the first time. The user must approve it / add a Bash permission
  rule for `git push` to `gist.github.com`. Flag this if it gets denied —
  do not try to bypass it.

## How screenshots are captured

Specs capture with the shared helper `e2e/helpers/screenshots.ts`:

```ts
import { makeShooter } from "./helpers/screenshots";

test("...", async ({ page }, testInfo) => {
  const shot = makeShooter(page, testInfo); // 3rd arg `true` => fullPage
  // ... drive the UI ...
  await expect(successAlert).toBeVisible();
  await shot("grade-saved");                // capture AFTER the assertion
});
```

Each `shot(name)` writes
`test-results/screenshots/<test-slug>/NN-<name>.png` (auto-numbered, grouped
per test) and attaches it to the HTML report.

**Rules for good evidence:**
- Capture *after* the `expect(...)` that proves the state — the screenshot is
  evidence of an asserted state, not whatever happened to render.
- Name shots descriptively in kebab-case; the embed humanizes the filename
  into the caption (`03-grade-saved` → "grade saved"), and the test-dir name
  into the section header. Good names = good captions, for free.
- `test-results/` is gitignored — these are artifacts, never committed.

## Workflow

1. **Run the suite** — it must pass before posting evidence:
   ```bash
   npm run test:e2e
   ```
   If it fails, fix the test/code first. Do not post screenshots of a failing
   run as if it passed.

2. **Embed into the PR** (uploads to a fresh secret gist, then prepends/
   replaces the block at the top of the description):
   ```bash
   .claude/skills/pr-screenshots/scripts/pr-screenshots.sh <pr-number>
   # optional 2nd arg: owner/repo (defaults to the current repo)
   ```

3. **Verify rendering** — open the PR URL the script prints and confirm the
   images actually display. Gist-raw hotlinks usually render, but GitHub's
   image proxy can occasionally reject them. If any image is broken, the
   fallback is an assets branch hotlinked via `raw.githubusercontent.com`
   (most reliable host) — switch to that and tell the user.

## Notes & gotchas

- **Delete-and-rebuild on re-run.** Each run creates a fresh secret gist (the
  description is `<repo> PR #<n> — e2e screenshot evidence`). If the PR already
  has a screenshot block, the script reads the old gist ID(s) from it,
  rebuilds the section against the new gist, and — only *after* the PR body is
  updated — deletes the previous gist so no stale images are left behind. If a
  delete fails it warns with the manual `gh gist delete <id>` command.
- **Secret ≠ private.** Anyone with the gist URL can view the images. Don't use
  this on a repo whose UI is sensitive without confirming with the user.
- **Idempotent embed.** The block is wrapped in
  `<!-- e2e-screenshots:start -->` / `<!-- e2e-screenshots:end -->` markers;
  the script replaces between them on re-run, so the description never stacks
  duplicate blocks.
- **Binary integrity.** PNGs are pushed via `git` (cloned gist), not
  `gh gist create` directly — the latter mangles binary as UTF-8 text.
