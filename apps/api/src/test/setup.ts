/**
 * Per-worker setup — runs before each test file. Truncates all application
 * data tables so each file starts from a clean slate. Schema is unchanged.
 */
import { beforeEach, afterAll } from "vitest";
import postgres from "postgres";

// At this point globalSetup has rewritten process.env.DATABASE_URL to point
// at the test DB. Open a single connection that lives for the worker.
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

// Tables to truncate between tests. Order matters only when CASCADE isn't
// used — we use CASCADE so dependencies are dropped automatically.
const TRUNCATE_TABLES = [
  "submission",
  "teaching_assistant_evaluation",
  "replay_interaction",
  "conversation_replay",
  "user_interaction_on_challenge",
  "work_session",
  "challenge_knowledge_base",
  "challenge_teaching_assistant",
  "challenge_solution",
  "challenge",
  "knowledge_base_chunk",
  "knowledge_base_document",
  "knowledge_base",
  "user_classroom",
  "classroom",
  "teaching_assistant",
  "model",
  "invitation",
  "organization_email_domain",
  "member",
  "session",
  "account",
  "verification",
  "organization",
  '"user"',
];

beforeEach(async () => {
  await sql.unsafe(
    `TRUNCATE TABLE ${TRUNCATE_TABLES.join(", ")} RESTART IDENTITY CASCADE;`
  );
});

afterAll(async () => {
  await sql.end();
});
