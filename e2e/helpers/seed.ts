/**
 * E2E helpers that talk to the dev database directly. Used by Playwright
 * specs to set up test fixtures (e.g. a submission row to grade) without
 * having to drive the student-solve flow through the UI.
 *
 * IMPORTANT: this connects to the DEV database (not the vitest test DB),
 * so it operates on data the user already seeded via `db:seed:dev`.
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dbuser:dbpass@localhost:5490/taco_dev";

const SEED_USER_TEACHER = "33333333-3333-3333-3333-333333330001";
const SEED_USER_STUDENT = "33333333-3333-3333-3333-333333330002";
const SEED_CLASSROOM_ALG = "22222222-2222-2222-2222-222222222201";
const SEED_CHALLENGE_CLASS_A = "00000000-0000-0000-0000-000000000013";

export const PROFESSOR = {
  email: "professor@taco-demo.local",
  password: "Teste123!@",
  id: SEED_USER_TEACHER,
};
export const STUDENT = {
  email: "aluno@taco-demo.local",
  password: "Teste123!@",
  id: SEED_USER_STUDENT,
};
export const SEED_CHALLENGE_ID = SEED_CHALLENGE_CLASS_A;
export const SEED_CLASSROOM_ID = SEED_CLASSROOM_ALG;

export interface SeedSubmissionResult {
  submissionId: string;
  workSessionId: string;
}

/**
 * Inserts a work_session (ended) + submission row for the seeded student
 * on the seeded challenge. Idempotent on (userId, challengeId) — reuses
 * the existing work session if present.
 *
 * Returns the submission id so a test can navigate to the detail page.
 */
export async function seedSubmissionForGrading(): Promise<SeedSubmissionResult> {
  const sql = postgres(DEV_DATABASE_URL, { max: 1 });

  try {
    // Look up an active TA in the seed org (created by seedBase via seedDev).
    const [taRow] = await sql<{ id: string }[]>`
      SELECT id FROM teaching_assistant WHERE is_active = true LIMIT 1
    `;
    if (!taRow) {
      throw new Error(
        "No teaching_assistant rows found — run `npm run db:seed:dev` first."
      );
    }

    // Get or create a work session for (student, challenge).
    let [session] = await sql<{ id: string; ended_at: Date | null }[]>`
      SELECT id, ended_at FROM work_session
      WHERE user_id = ${STUDENT.id} AND challenge_id = ${SEED_CHALLENGE_ID}
      LIMIT 1
    `;
    if (!session) {
      const wsId = randomUUID();
      const now = new Date();
      await sql`
        INSERT INTO work_session
          (id, user_id, challenge_id, classroom_id, teaching_assistant_id, ended_at, last_message_at, created_at, updated_at)
        VALUES
          (${wsId}, ${STUDENT.id}, ${SEED_CHALLENGE_ID}, ${SEED_CLASSROOM_ID}, ${taRow.id}, ${now}, ${now}, ${now}, ${now})
      `;
      session = { id: wsId, ended_at: now };
    } else if (!session.ended_at) {
      // Mark as ended so the submission grid treats it as submittable
      await sql`UPDATE work_session SET ended_at = NOW() WHERE id = ${session.id}`;
    }

    // Insert a submission if one doesn't exist for this work session.
    let [sub] = await sql<{ id: string }[]>`
      SELECT id FROM submission WHERE work_session_id = ${session.id} LIMIT 1
    `;
    if (!sub) {
      const subId = randomUUID();
      await sql`
        INSERT INTO submission
          (id, work_session_id, challenge_id, student_user_id, code, submitted_at)
        VALUES
          (${subId}, ${session.id}, ${SEED_CHALLENGE_ID}, ${STUDENT.id}, ${"print('hello world')"}, NOW())
      `;
      sub = { id: subId };
    }

    return { submissionId: sub.id, workSessionId: session.id };
  } finally {
    await sql.end();
  }
}

/** Clears auto-review + grade so the test exercises the empty-state path. */
export async function resetSubmissionGrade(submissionId: string) {
  const sql = postgres(DEV_DATABASE_URL, { max: 1 });
  try {
    await sql`
      UPDATE submission
      SET grade = NULL, grading_comment = NULL, graded_by_user_id = NULL,
          graded_at = NULL, auto_review = NULL, auto_review_at = NULL
      WHERE id = ${submissionId}
    `;
  } finally {
    await sql.end();
  }
}
