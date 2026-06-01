import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { submission, challengeReferenceSolution } from "@repo/infra/db/schema";
import {
  recoverStaleRunningJobs,
  RESTART_RECOVERY_MESSAGE,
} from "../job-recovery";
import {
  createChallenge,
  createClassroom,
  createOrg,
  createSubmission,
  createTeachingAssistant,
  createUser,
  createWorkSession,
} from "../../../test/helpers/factories";

describe("job-recovery: recoverStaleRunningJobs", () => {
  let challengeId: string;
  let workSessionId: string;
  let studentId: string;

  beforeEach(async () => {
    const org = await createOrg();
    const teacher = await createUser();
    const student = await createUser();
    studentId = student.id;
    const cls = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    const ch = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: cls.id,
    });
    challengeId = ch.id;
    const ta = await createTeachingAssistant({ organizationId: org.id });
    const ws = await createWorkSession({
      userId: student.id,
      challengeId: ch.id,
      classroomId: cls.id,
      teachingAssistantId: ta.id,
    });
    workSessionId = ws.id;
  });

  it("flips running auto-reviews and reference solutions to failed", async () => {
    const sub = await createSubmission({
      workSessionId,
      challengeId,
      studentUserId: studentId,
    });
    await db
      .update(submission)
      .set({ autoReviewStatus: "running" })
      .where(eq(submission.id, sub.id));

    const refId = randomUUID();
    await db.insert(challengeReferenceSolution).values({
      id: refId,
      challengeId,
      kind: "brute_force",
      status: "running",
      createdBy: "ai",
    });

    const result = await recoverStaleRunningJobs();
    expect(result.submissions).toBe(1);
    expect(result.referenceSolutions).toBe(1);

    const [s] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(s!.autoReviewStatus).toBe("failed");
    expect(s!.autoReviewError).toBe(RESTART_RECOVERY_MESSAGE);

    const [r] = await db
      .select()
      .from(challengeReferenceSolution)
      .where(eq(challengeReferenceSolution.id, refId));
    expect(r!.status).toBe("failed");
    expect(r!.error).toBe(RESTART_RECOVERY_MESSAGE);
  });

  it("leaves non-running jobs untouched", async () => {
    const sub = await createSubmission({
      workSessionId,
      challengeId,
      studentUserId: studentId,
    });
    await db
      .update(submission)
      .set({ autoReviewStatus: "complete", autoReview: "tudo certo" })
      .where(eq(submission.id, sub.id));

    const refId = randomUUID();
    await db.insert(challengeReferenceSolution).values({
      id: refId,
      challengeId,
      kind: "refined",
      status: "complete",
      code: "print(1)",
      createdBy: "manual",
      generatedAt: new Date(),
    });

    const result = await recoverStaleRunningJobs();
    expect(result.submissions).toBe(0);
    expect(result.referenceSolutions).toBe(0);

    const [s] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(s!.autoReviewStatus).toBe("complete");

    const [r] = await db
      .select()
      .from(challengeReferenceSolution)
      .where(eq(challengeReferenceSolution.id, refId));
    expect(r!.status).toBe("complete");
  });
});
