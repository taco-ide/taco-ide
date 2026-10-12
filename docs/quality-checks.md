# Quality checks

The `Quality checks` GitHub Actions workflow runs on every pull request and every
push to `main`. It installs the lockfile with Node.js 22 and npm 11.3.0, then runs:

1. `npm run check-types`: the API, web and infrastructure `typecheck` tasks, plus
   the Playwright configuration, specs and helpers under strict TypeScript.
2. `npm run lint`: API and web ESLint checks, plus Playwright specs, helpers
   and configuration using the API's TypeScript ESLint rules. Existing warnings are reported;
   errors fail the run.
3. `npm run build`: production builds of infrastructure, API and web.
4. `npm test`: Vitest API tests against a separate PostgreSQL database.
5. `npm run test:e2e`: Chromium browser tests against the built API and web.
   The API bundle runs through `tsx` because the shared infrastructure package
   currently exports TypeScript source with extensionless imports.

The root type check uses the actual workspace task name, `typecheck`. The previous
`check-types` Turbo task did not match workspace scripts and could succeed without
checking any application code.

## Native build dependencies

The committed lockfile includes optional native packages for Linux, macOS and
other supported platforms. CI needs the Linux x64 variants of Rollup, esbuild,
Next/SWC, sharp, lightningcss and the resolver used by ESLint. A lockfile produced
from an existing macOS installation can omit variants needed by a clean Linux
installation, causing `npm ci` to finish but a later build to fail.

When updating native tooling, regenerate missing optional metadata in a clean
temporary project without `node_modules`, using the exact parent versions already
resolved in the lockfile. Preserve existing resolved versions and production
flags; commit the platform variants and their optional dependencies together.
Validate with a clean Linux `npm ci` and the API build, as well as the usual type
and lint checks. A successful installation on macOS alone does not cover this
cross-platform requirement.

## Disposable databases

CI starts a PostgreSQL 16 service with pgvector. No production database or project
secret is required. Browser tests use `taco_ci_e2e`; API tests derive
`taco_ci_e2e_test` from `DATABASE_URL` and recreate only that suffixed database.
The PostgreSQL account must be allowed to create databases and install pgvector.
API tests do not seed or truncate the browser-test database.

Before browser tests, the workflow installs the `vector` extension, applies the
checked-in migrations, pushes the current Drizzle schema, and runs `db:seed:dev`.
The schema push is intentional for these disposable test databases: it tests the
current application schema even when migrations lag behind it. It is not a
production migration procedure. The API test global setup uses the same schema
push strategy for its fresh `_test` database.

The fixtures contain the demo professor, student, organization, classroom and
challenge required by `e2e/helpers/seed.ts`. The grading test verifies persistence
after reloading the page; the wizard test verifies saving and continuing are two
separate actions. Both run with the English locale cookie set explicitly.

## Run the checks locally

Install Node.js 22.9+ and npm 11, then run `npm ci`. Point `DATABASE_URL` at a local,
disposable PostgreSQL database with pgvector available. Do not use a shared or
production database: API tests drop and recreate the suffixed `_test` database;
browser tests write grades and create challenges in the base database.

Example test-only environment in the root `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taco_local_e2e
BETTER_AUTH_SECRET=local-tests-only-secret-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4001
NEXT_PUBLIC_API_URL=http://localhost:4000
E2E_API_URL=http://localhost:4000
E2E_FRONTEND_URL=http://localhost:4001
LLM_API_KEY=local-dummy-key
LLM_API_BASE=http://127.0.0.1:9/v1/
EMBEDDING_API_URL=http://127.0.0.1:9/v1/embeddings
CODE_EXEC_API_URL=http://127.0.0.1:9/execute
LANGFUSE_ENABLED=false
RESEND_API_KEY=
```

Create the base database separately, then prepare it with these commands:

```bash
# psql uses the example URL directly; npm commands load the root .env.
psql postgresql://postgres:postgres@localhost:5432/taco_local_e2e \
  -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector;'
npm run db:migrate --workspace=@repo/infra
npm run db:push --workspace=@repo/infra
npm run db:seed:dev --workspace=@repo/infra
npx playwright install chromium

npm run check-types
npm run lint
npm run build
npm test
npm run test:e2e
```

By default Playwright starts the development servers and can reuse a running
local stack. `E2E_API_URL` and `E2E_FRONTEND_URL` also set the spawned server ports.
For example, set both URLs to `localhost:4200` and `localhost:4201` to avoid
colliding with a development session. Keep `BETTER_AUTH_URL`, `FRONTEND_URL` and
`NEXT_PUBLIC_API_URL` consistent; the public API URL is embedded at build time.

To reproduce CI's production-server mode, build with the intended URLs first,
then run `CI=true E2E_USE_BUILD=true npm run test:e2e`. CI never reuses existing
servers. These tests use dummy local LLM/embedding/code-execution endpoints, no
Resend key, and disabled Langfuse; real AI generation and mail delivery are
outside this suite's scope. Reference generation may log a local connection
failure while the wizard save and navigation assertions still pass.

## Reports and screenshots

Playwright writes an HTML report to `playwright-report/`, attaches screenshots
captured after asserted milestones, and retains traces, video and automatic
screenshots on failure. CI uploads both `playwright-report/` and `test-results/`
as a run artifact even when a check fails; retention is 14 days. If the suite
never starts, there may be no browser artifacts to upload.

Locally, open the last report with `npx playwright show-report`. Evidence under
`test-results/screenshots/` is grouped by test title and ordered by capture.
Reports and evidence are ignored by Git.
