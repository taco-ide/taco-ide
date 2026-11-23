import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challengeSolution,
  submission,
  userInteractionOnChallenge,
  workSession,
} from "@repo/infra/db/schema";
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
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

describe("work session reset", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let challengeId: string;
  let studentId: string;
  let ws: Awaited<ReturnType<typeof createWorkSession>>;
  let cookies: { teacher: string; student: string };

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    const org = await createOrg();
    const teacher = await createUser();
    const student = await createUser();
    studentId = student.id;
    await addMember(teacher.id, org.id, "teacher");
    await addMember(student.id, org.id, "student");
    const classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    await enrollStudent(student.id, classroom.id);
    challengeId = (
      await createChallenge({ classroomId: classroom.id, createdByUserId: teacher.id })
    ).id;
    const ta = await createTeachingAssistant({ organizationId: org.id });
    ws = await createWorkSession({
      userId: student.id,
      challengeId,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    await addInteraction({ workSessionId: ws.id, challengeId });
    await createSubmission({ workSessionId: ws.id, challengeId, studentUserId: student.id });
    await db.insert(challengeSolution).values({
      id: randomUUID(),
      userId: student.id,
      challengeId,
      code: "print('attempt 1')",
    });
    cookies = {
      teacher: await loginAs({ email: teacher.email, password: TEST_PASSWORD }),
      student: await loginAs({ email: student.email, password: TEST_PASSWORD }),
    };
  });

  function reset(id = ws.id) {
    return app.inject({
      method: "DELETE",
      url: `/v1/work-sessions/${id}/reset`,
      headers: { cookie: cookies.teacher },
    });
  }

  it("archives the session and keeps its interactions and submission", async () => {
    const response = await reset();

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ archived: true });
    const [session] = await db.select().from(workSession).where(eq(workSession.id, ws.id));
    expect(session?.archivedAt).toBeInstanceOf(Date);
    expect(
      await db
        .select()
        .from(userInteractionOnChallenge)
        .where(eq(userInteractionOnChallenge.workSessionId, ws.id))
    ).toHaveLength(1);
    expect(
      await db.select().from(submission).where(eq(submission.workSessionId, ws.id))
    ).toHaveLength(1);
    const [solution] = await db
      .select()
      .from(challengeSolution)
      .where(eq(challengeSolution.userId, studentId));
    expect(solution?.code).toBeNull();
  });

  it("lets the student start a new session after a reset", async () => {
    await reset();
    const headers = { cookie: cookies.student };

    const before = await app.inject({
      url: `/v1/work-sessions/by-challenge?challengeId=${challengeId}`,
      headers,
    });
    expect(before.json().data).toBeNull();

    const created = await app.inject({
      method: "POST",
      url: "/v1/work-sessions/",
      headers,
      payload: { challengeId },
    });
    expect(created.statusCode).toBe(201);
    const newId = created.json().data.id;
    expect(newId).not.toBe(ws.id);

    const again = await app.inject({
      method: "POST",
      url: "/v1/work-sessions/",
      headers,
      payload: { challengeId },
    });
    expect(again.json().data.id).toBe(newId);

    const after = await app.inject({
      url: `/v1/work-sessions/by-challenge?challengeId=${challengeId}`,
      headers,
    });
    expect(after.json().data.id).toBe(newId);
    expect(
      await db.select().from(workSession).where(eq(workSession.userId, studentId))
    ).toHaveLength(2);
  });

  it("refuses writes to an archived session", async () => {
    await reset();
    const student = { cookie: cookies.student };
    // Reopen it first so the archive, not the submission, is what blocks writes.
    await db.update(workSession).set({ endedAt: null }).where(eq(workSession.id, ws.id));

    const writes = [
      { method: "POST", url: `/v1/work-sessions/${ws.id}/chat`, headers: student, payload: { message: "hi" } },
      {
        method: "POST",
        url: "/v1/chat/student/message",
        headers: student,
        payload: { workSessionId: ws.id, message: "hi" },
      },
      {
        method: "POST",
        url: `/v1/work-sessions/${ws.id}/interactions`,
        headers: student,
        payload: { interactionType: "code_run", code: "print(1)" },
      },
      { method: "POST", url: `/v1/work-sessions/${ws.id}/submit`, headers: student, payload: {} },
    ] as const;
    for (const write of writes) {
      const response = await app.inject(write);
      expect(response.statusCode, write.url).toBe(400);
      expect(response.json().message, write.url).toBe("Work session was reset");
    }

    await db.update(workSession).set({ endedAt: new Date() }).where(eq(workSession.id, ws.id));
    const reopen = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${ws.id}/reopen`,
      headers: { cookie: cookies.teacher },
    });
    expect(reopen.statusCode).toBe(400);
    expect(reopen.json().message).toBe("Work session was reset");
    const again = await reset();
    expect(again.statusCode).toBe(400);
    expect(again.json().message).toBe("Work session was already reset");
  });

  it("shows the archived session to the teacher but hides its submission", async () => {
    await reset();
    const headers = { cookie: cookies.teacher };

    const sessions = await app.inject({
      url: `/v1/challenges/${challengeId}/work-sessions`,
      headers,
    });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.json().data).toEqual([
      expect.objectContaining({ workSessionId: ws.id, archivedAt: expect.any(String) }),
    ]);

    const submittedOnly = await app.inject({
      url: `/v1/challenges/${challengeId}/work-sessions?submittedOnly=true`,
      headers,
    });
    expect(submittedOnly.json().data).toEqual([]);

    const submissions = await app.inject({
      url: `/v1/challenges/${challengeId}/submissions`,
      headers,
    });
    expect(submissions.statusCode).toBe(200);
    expect(submissions.json().data).toEqual([]);
    expect(submissions.json().pagination.total).toBe(0);

    const replay = await app.inject({ url: `/v1/work-sessions/${ws.id}`, headers });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.archivedAt).toEqual(expect.any(String));
    expect(replay.json().data.interactions).toHaveLength(1);
  });
});
