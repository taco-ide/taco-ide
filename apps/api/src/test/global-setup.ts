/**
 * Vitest globalSetup — runs ONCE before any test worker.
 *
 * Responsibilities:
 *   1. Derive a dedicated test DATABASE_URL (suffix "_test" on the db name)
 *      and set it on process.env so workers inherit it.
 *   2. Ensure the test database exists (drop + create against the postgres
 *      admin DB), then push the current Drizzle schema into it. We push
 *      rather than migrate to keep this fast and resilient when migrations
 *      lag behind the schema during PR work.
 */
import { execSync } from "node:child_process";
import postgres from "postgres";
import path from "node:path";

function deriveTestDbUrl(baseUrl: string): { url: string; dbName: string } {
  const u = new URL(baseUrl);
  const originalDb = u.pathname.replace(/^\//, "");
  const testDb = `${originalDb}_test`;
  u.pathname = `/${testDb}`;
  return { url: u.toString(), dbName: testDb };
}

export default async function setup() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Run tests via `npm test` (which loads .env)."
    );
  }

  const { url: testUrl, dbName } = deriveTestDbUrl(baseUrl);
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";

  // Connect to the default `postgres` admin DB to create the test DB.
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    // Terminate any lingering connections, then drop+create cleanly.
    await admin`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${dbName} AND pid <> pg_backend_pid();
    `;
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}";`);
    await admin.unsafe(`CREATE DATABASE "${dbName}";`);
  } finally {
    await admin.end();
  }

  // Install pgvector extension on the freshly created test DB.
  const testDb = postgres(testUrl, { max: 1 });
  try {
    await testDb`CREATE EXTENSION IF NOT EXISTS vector;`;
  } finally {
    await testDb.end();
  }

  // Push schema using drizzle-kit. We invoke it as a CLI in the infra package
  // with DATABASE_URL pointing at the test DB.
  const infraPath = path.resolve(__dirname, "../../../../packages/infra");
  execSync(
    `npx drizzle-kit push --config ./drizzle.config.ts --force`,
    {
      cwd: infraPath,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: "inherit",
    }
  );

  return async () => {
    // teardown: nothing — the test DB is recreated on next run.
  };
}
