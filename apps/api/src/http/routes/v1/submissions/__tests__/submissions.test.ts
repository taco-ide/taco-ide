/**
 * Covers the submission lifecycle: submit (work-sessions route), list,
 * getById, and grade. Auto-review is mocked at the module level so the
 * submit tests don't hit the real LLM.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { submission } from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addInteraction,
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createSubmission,
  createTeachingAssistant,
  createUser,
  createWorkSession,
  enrollStudent,
  linkChallengeToTa,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

// Mock auto-review so submit() doesn't try to call the real LLM.
vi.mock("../../../../../agents/teachers-companion/auto-review", () => ({
  runAutoReview: vi.fn(async () => {}),
}));

describe("submission lifecycle", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let otherTeacher: Awaited<ReturnType<typeof createUser>>;
  let classroom: Awaited<ReturnType<typeof createClassroom>>;
  let ta: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let challengeRow: Awaited<ReturnType<typeof createChallenge>>;
  let teacherCookie: string;
  let studentCookie: string;
  let otherTeacherCookie: string;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    org = await createOrg();
    teacher = await createUser();
    student = await createUser();
    otherTeacher = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    await addMember(student.id, org.id, "student");
    await addMember(otherTeacher.id, org.id, "teacher");

    classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    await enrollStudent(student.id, classroom.id);
    ta = await createTeachingAssistant({ organizationId: org.id });
    challengeRow = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });
    await linkChallengeToTa(challengeRow.id, ta.id);

    teacherCookie = await loginAs({ email: teacher.email, password: TEST_PASSWORD });
    studentCookie = await loginAs({ email: student.email, password: TEST_PASSWORD });
    otherTeacherCookie = await loginAs({
      email: otherTeacher.email,
      password: TEST_PASSWORD,
    });
  });

  // ===== submit =====

  it("submit creates a submission row and returns the id", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
    });
    await addInteraction({
      workSessionId: session.id,
      challengeId: challengeRow.id,
      interactionType: "code_run",
      code: "print(1)",
    });

    const res = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${session.id}/submit`,
      headers: { cookie: studentCookie },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { submissionId: string | null; endedAt: string } };
    expect(body.data.submissionId).toBeTruthy();
    expect(body.data.endedAt).toBeTruthy();

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, body.data.submissionId!));
    expect(row).toBeDefined();
    expect(row!.workSessionId).toBe(session.id);
    expect(row!.studentUserId).toBe(student.id);
  });

  it("double-submit returns 400", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
    });

    const first = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${session.id}/submit`,
      headers: { cookie: studentCookie },
      payload: {},
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${session.id}/submit`,
      headers: { cookie: studentCookie },
      payload: {},
    });
    expect(second.statusCode).toBe(400);
  });

  // ===== list =====

  it("professor sees submissions in the list (including deleted-student rows)", async () => {
    // Two submissions: one normal, one with studentUserId nullified (simulates deleted user).
    const session1 = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    await createSubmission({
      workSessionId: session1.id,
      challengeId: challengeRow.id,
      studentUserId: student.id,
    });

    const ghostStudent = await createUser();
    await addMember(ghostStudent.id, org.id, "student");
    const session2 = await createWorkSession({
      userId: ghostStudent.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    await createSubmission({
      workSessionId: session2.id,
      challengeId: challengeRow.id,
      studentUserId: null, // simulates ON DELETE SET NULL
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeRow.id}/submissions/`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ submissionId: string; studentUserId: string | null; studentName: string | null }>;
      pagination: { total: number };
    };
    expect(body.pagination.total).toBe(2);
    // Confirm the null-studentUserId row is present (leftJoin behavior)
    expect(body.data.some((r) => r.studentUserId === null && r.studentName === null)).toBe(true);
  });

  it("student gets 403 on the list endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeRow.id}/submissions/`,
      headers: { cookie: studentCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("unrelated teacher gets 403 on the list endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeRow.id}/submissions/`,
      headers: { cookie: otherTeacherCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // ===== getById =====

  it("getById returns the submission detail for the owning teacher", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: challengeRow.id,
      studentUserId: student.id,
      code: "print('test')",
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { code: string | null; studentName: string | null } };
    expect(body.data.code).toBe("print('test')");
    expect(body.data.studentName).toBe(student.name);
  });

  it("getById 404s when submission belongs to a different challenge", async () => {
    const otherChallenge = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });
    const session = await createWorkSession({
      userId: student.id,
      challengeId: otherChallenge.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: otherChallenge.id,
      studentUserId: student.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}`,
      headers: { cookie: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  // ===== grade =====

  it("grading persists grade + comment + gradedByUserId", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: challengeRow.id,
      studentUserId: student.id,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}/grade`,
      headers: { cookie: teacherCookie },
      payload: { grade: "9.5", comment: "Bom" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { grade: string | null; gradingComment: string | null; gradedByUserId: string | null } };
    expect(body.data.grade).toBe("9.5");
    expect(body.data.gradingComment).toBe("Bom");
    expect(body.data.gradedByUserId).toBe(teacher.id);
  });

  it("regrading overwrites the previous value", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: challengeRow.id,
      studentUserId: student.id,
    });

    await app.inject({
      method: "PUT",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}/grade`,
      headers: { cookie: teacherCookie },
      payload: { grade: "5" },
    });
    const second = await app.inject({
      method: "PUT",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}/grade`,
      headers: { cookie: teacherCookie },
      payload: { grade: "10", comment: "great" },
    });
    expect(second.statusCode).toBe(200);
    const body = second.json() as { data: { grade: string | null; gradingComment: string | null } };
    expect(body.data.grade).toBe("10");
    expect(body.data.gradingComment).toBe("great");
  });

  it("student cannot grade (403)", async () => {
    const session = await createWorkSession({
      userId: student.id,
      challengeId: challengeRow.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: challengeRow.id,
      studentUserId: student.id,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}/grade`,
      headers: { cookie: studentCookie },
      payload: { grade: "10" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("grade with cross-challenge submission id returns 404", async () => {
    const otherChallenge = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });
    const session = await createWorkSession({
      userId: student.id,
      challengeId: otherChallenge.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: session.id,
      challengeId: otherChallenge.id,
      studentUserId: student.id,
    });

    const res = await app.inject({
      method: "PUT",
      url: `/v1/challenges/${challengeRow.id}/submissions/${sub.id}/grade`,
      headers: { cookie: teacherCookie },
      payload: { grade: "10" },
    });
    expect(res.statusCode).toBe(404);
  });
});
