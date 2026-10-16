# Runtime dependency security updates

This update follows issue #114 and upgrades the runtime packages that had fixes available without a framework migration. Use Node.js 22.12 or newer and npm 11.3.0; the root engine now matches the complete runtime and development toolchain.

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

## Verification

The upgraded packages passed strict workspace types, lint and all production builds on Node 22. Tests use real authentication sessions and a disposable PostgreSQL database; compatibility coverage includes both auth namespaces, CSV-created users, migration preservation and ambiguity handling, explicit administrator password rotation, and repeated development/demo seeds. Run the combined authentication and resource suites after integrating their independent PRs, and run the Chromium grade-persistence and challenge-wizard flows.
