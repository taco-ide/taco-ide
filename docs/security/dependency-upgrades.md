# Runtime dependency security updates

This update follows issue #114 and upgrades the runtime packages that had fixes available without a framework migration. Use Node.js 22.12 or newer and the npm version pinned in `packageManager` (11.21.3); the root engine now matches the complete runtime and development toolchain.

## Package changes

- Better Auth 1.7.7 and Drizzle ORM 0.45.4.
- Next.js 16.4.0, matching Next ESLint packages, and PostCSS 8.5.30.
- Fastify 5.12.5 and js-yaml 4.3.2, preserving their major versions.
- LangChain core 1.2.17, LangGraph 1.4.21 and the OpenAI integration 1.6.2.
- shell-quote 1.12.0, a compatible transitive update through Kubb/devtools, removing the critical report from the complete dependency tree.
- csv-parse 7.0.3. Its major update is required for the available fix; the existing named parser API and the CSV-import integration tests remain compatible.

The lockfile pins the verified versions. Cross-platform optional binary entries must be retained so `npm ci` can build on both macOS and Linux; regenerating a lockfile from an already-populated macOS node_modules can omit Linux Rollup dependencies.

## Credential compatibility and deployment order

Better Auth's credential provider now requires `account.account_id` to equal the owning `user.id`. Application-created CSV accounts, test factories and development/admin seeds now write this canonical value. Existing credential accounts need the data-only migration `0011_credential_account_identifiers.sql` before running the upgraded authentication provider.

The migration changes only credential account identifiers. It preserves account ids, password hashes, timestamps and OAuth accounts. It locks the account table and aborts atomically if a user has multiple credential accounts; resolve that ambiguity deliberately before retrying. Re-running the normalization is safe. Take the normal database backup, run the migration, then start the upgraded application. `db:push` does not apply this data migration and is insufficient for existing accounts.

The credential migration follows main's `0010_mature_silver_surfer` as migration 0011. PR #110 still introduces migration 0010 and must be renumbered when integrated; verify the entire sequence on a disposable database before deployment. Do not publish a release with conflicting journal indices.

Seed normalization preserves existing passwords, including changed demo passwords. The platform-admin seed keeps its explicit rotation contract: changing `PLATFORM_ADMIN_PASSWORD` rotates that administrator's password; reusing the same configured password preserves the hash. Duplicate credentials fail without partially promoting an existing user.

## Audit result and remaining work

The `npm audit --omit=dev` snapshots taken for this change reported 42 alerts before the update (2 critical, 25 high, 15 moderate) and 26 afterward (0 critical, 15 high, 11 moderate). Counts include dependency paths pulled into workspace tooling and are not a measure of reachable production vulnerabilities.

The original complete audit snapshot including development packages reported 36 remaining alerts (0 critical, 22 high, 14 moderate), after fixing shell-quote. The API Docker image currently includes the full workspace dependency tree for its source/loader setup; development labels alone do not exclude packages from that image. Evaluate the full report when assessing the image, and track reducing its dependency footprint in #119. The runtime-only snapshot and full-tree snapshot have different scopes.

The review-time `npm audit --omit=dev` snapshot on 2026-10-16 reported 25 alerts (0 critical, 13 high, 12 moderate). It also flags Fastify busboy/static, URI parsing and LangSmith dependency paths, alongside the Tailwind 3 plugin/build chain, Drizzle Kit/esbuild and Vitest/coverage tooling. Remaining advisories therefore include runtime dependency paths, not only development tooling. Counts can change as advisories are published or revised, even with the same lockfile.

Remaining dependency remediation requires separate version and compatibility verification; automatic force-fix suggestions include disruptive migrations or downgrades and were not applied. Issue #119 tracks that follow-up separately from the runtime update in #114. The absence of critical alerts does not mean the complete dependency tree is free of advisories.

## Follow-up advisory remediation (#119, 2026-11-22)

Snapshot before this change, on the same lockfile as main: `npm audit --omit=dev` reported 26 alerts (1 critical, 10 high, 14 moderate, 1 low). The critical was a newly published Next.js advisory set for 16.0.0-16.4.4, including unauthenticated RCE in the image optimizer. The complete tree reported 45 alerts (1 critical, 20 high, 23 moderate, 1 low).

Changes, all without `npm audit fix --force` and without new `overrides`:

- Next.js, `@next/eslint-plugin-next` and `eslint-config-next` 16.4.6 (deployed web runtime).
- `@fastify/swagger-ui` 6.1.5, which moves `@fastify/static` from 9.0.0 to 10.1.12 to fix its path-traversal and route-guard bypass advisories (deployed API runtime, serves `/docs`). Swagger UI 6 only removes the deprecated `useUnsafeMarkdown` option, which the API does not use.
- In-range lockfile refreshes for API runtime paths: `@fastify/busboy` 3.2.6 (multipart uploads), Fastify 5.12.8, `fast-uri` 3.1.9/4.2.3, `defu` 6.1.7 (Better Auth), LangSmith 0.13.1 (LangChain core; drops the vulnerable `uuid` 10 path), `picomatch`, `yaml` and `baseline-browser-mapping`.
- Test tooling: Vitest and `@vitest/coverage-v8` 4.1.12, Vite 8.3.8 (same majors; all Rolldown platform bindings retained).
- Build tooling, in range: turbo 2.11.13, typescript-eslint 8.73.0, hono 4.13.20, `@humanfs/node`, `brace-expansion`, browserslist, lodash, `path-to-regexp` and `ws`.

Snapshot after: `npm audit --omit=dev` reports 8 alerts (0 critical, 2 high, 6 moderate); the complete tree reports 14 (0 critical, 7 high, 7 moderate).

Remaining advisories, recorded explicitly:

| Package | Severity | Path | Usage | Why not fixed here |
| --- | --- | --- | --- | --- |
| `zod` < 4.6.6 (GHSA-mrhx-c7xc-m3w5) and `fastify-type-provider-zod` <= 4.0.2 | high | API, web, infra | Deployed runtime (request validation) | No patched 3.x release. Requires the Zod 4 migration together with `fastify-type-provider-zod` 6 or 7 (both require `zod` >= 4.1.5), Kubb-generated Zod schemas and web form schemas. Plan as its own change. The Zod migration alone does not clear the Kubb chain below, which keeps its own Zod 3 copy. |
| `postcss-selector-parser` <= 6.1.4 via `tailwindcss` 3 and `@tailwindcss/typography` | moderate | web | Build only (CSS compilation of trusted sources) | The fix requires the Tailwind 4 plugin chain; plan that migration separately with browser regression coverage. |
| `esbuild` <= 0.24.2 via `@esbuild-kit/*` in `drizzle-kit` 0.31.x | moderate | infra | Migration/development CLI | The advisory concerns esbuild's development server, which drizzle-kit does not start. Every 0.31.x release, including the latest 0.31.11, still depends on `@esbuild-kit`; only the 1.0 release candidates drop it. Re-evaluate when drizzle-kit 1.0 is stable and verify `db:generate`, `db:migrate` and `db:push` before adopting it. |
| Kubb chain: `@kubb/cli` and `@kubb/ui` 3.18.3, `@hono/zod-openapi` 0.19.2, `@hono/zod-validator` 0.4.3, `@asteasolutions/zod-to-openapi` 7.3.4 (all via `zod` 3.25.76, GHSA-mrhx-c7xc-m3w5), and `@hono/node-server` 1.19.19 (GHSA-rmxm-3fg6-px4f) | 5 high, 1 moderate | API devDependency | Code generation only (`npm run kubb`) | `@kubb/ui` 3.18.3 pins `@hono/zod-openapi` 0.19.2 exactly and `zod` ^3.25.76, so the application's Zod migration cannot remove these paths. Kubb 3.18.3 is the newest 3.x release; `@kubb/cli` 4.0.2 and later no longer depend on `@kubb/ui`. Needs the Kubb 4 (>= 4.0.2) upgrade of the CLI and all `@kubb/plugin-*` packages, with the generated types, hooks and Zod schemas re-verified. |

The lockfile was regenerated with npm 11.21.3 (the `edgesOut` arborist error in npm 11.3.0 blocks updating the Vitest peer set). The root `packageManager` field and the CI workflow now pin npm 11.21.3, the version that wrote the lockfile: with 11.3.0, `npm install` rewrites about a hundred `dev`/`peer` flags, while 11.21.3 leaves the lockfile unchanged. Platform-specific optional entries (Next SWC, esbuild, Rolldown, LightningCSS, sharp, Parcel watcher, turbo) are retained for macOS, Linux and Windows.

The API image footprint work described above (separating generation, test, build and migration-only dependencies from the runner image) is not part of this change and remains open under #119.

## Verification

The upgraded packages passed strict workspace types, lint and all production builds on Node 22. Tests use real authentication sessions and a disposable PostgreSQL database; compatibility coverage includes both auth namespaces, CSV-created users, migration preservation and ambiguity handling, explicit administrator password rotation, and repeated development/demo seeds. Run the combined authentication and resource suites after integrating their independent PRs, and run the Chromium grade-persistence and challenge-wizard flows.
