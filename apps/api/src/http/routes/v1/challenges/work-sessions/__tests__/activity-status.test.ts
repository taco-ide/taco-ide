/**
 * Derived work-session activity status (#52): active / inactive / submitted
 * is computed on read from the latest student activity. Nothing is closed or
 * written when a session goes idle.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { challengeSolution, workSession } from "@repo/infra/db/schema";
import { getApp } from "../../../../../../test/helpers/app";
import { loginAs } from "../../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createTeachingAssistant,
  createUser,
  createWorkSession,
  enrollStudent,
  linkChallengeToTa,
  TEST_PASSWORD,
} from "../../../../../../test/helpers/factories";

const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

type Row = {
  workSessionId: string;
  lastActivityAt: string;
  activityStatus: "active" | "inactive" | "submitted";
  endedAt: string | null;
};
type ListBody = { data: Row[]; pagination: { total: number } };

describe("work-session activity status", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let teacherCookie: string;
  let challengeId: string;
  let activeStudent: Awaited<ReturnType<typeof createUser>>;
  let sessions: Record<"active" | "inactive" | "solutionSave" | "submitted", string>;
  let solutionSavedAt: Date;
  let inactiveLastMessageAt: Date;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    const org = await createOrg();
    const teacher = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    const classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    const ta = await createTeachingAssistant({ organizationId: org.id });
    const challenge = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });
    challengeId = challenge.id;
    await linkChallengeToTa(challenge.id, ta.id);

    const newStudentSession = async (opts: {
      lastMessageAt?: Date | null;
      endedAt?: Date | null;
    }) => {
      const student = await createUser();
      await addMember(student.id, org.id, "student");
      await enrollStudent(student.id, classroom.id);
      const ws = await createWorkSession({
        userId: student.id,
        challengeId: challenge.id,
        classroomId: classroom.id,
        teachingAssistantId: ta.id,
        createdAt: ago(72 * HOUR),
        lastMessageAt: opts.lastMessageAt ?? null,
        endedAt: opts.endedAt ?? null,
      });
      return { student, ws };
    };

    const active = await newStudentSession({ lastMessageAt: ago(HOUR) });
    activeStudent = active.student;

    inactiveLastMessageAt = ago(48 * HOUR);
    const inactive = await newStudentSession({
      lastMessageAt: inactiveLastMessageAt,
    });

    // No chat at all, but the student saved code recently.
    const solutionSave = await newStudentSession({ lastMessageAt: null });
    solutionSavedAt = ago(10 * 60 * 1000);
    await db.insert(challengeSolution).values({
      id: randomUUID(),
      userId: solutionSave.student.id,
      challengeId: challenge.id,
      code: "print(1)",
      updatedAt: solutionSavedAt,
    });

    // Submitted long ago: stays "submitted", never "inactive".
    const submitted = await newStudentSession({
      lastMessageAt: ago(60 * HOUR),
      endedAt: ago(59 * HOUR),
    });

    sessions = {
      active: active.ws.id,
      inactive: inactive.ws.id,
      solutionSave: solutionSave.ws.id,
      submitted: submitted.ws.id,
    };

    teacherCookie = await loginAs({ email: teacher.email, password: TEST_PASSWORD });
  });

  async function list(query = ""): Promise<ListBody> {
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeId}/work-sessions?perPage=50${query}`,
      headers: { cookie: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as ListBody;
  }

  it("derives a status and lastActivityAt for each listed session", async () => {
    const body = await list();
    const byId = new Map(body.data.map((r) => [r.workSessionId, r]));

    expect(byId.get(sessions.active)!.activityStatus).toBe("active");
    expect(byId.get(sessions.inactive)!.activityStatus).toBe("inactive");
    expect(byId.get(sessions.solutionSave)!.activityStatus).toBe("active");
    expect(byId.get(sessions.submitted)!.activityStatus).toBe("submitted");

    expect(byId.get(sessions.inactive)!.lastActivityAt).toBe(
      inactiveLastMessageAt.toISOString()
    );
    expect(byId.get(sessions.solutionSave)!.lastActivityAt).toBe(
      solutionSavedAt.toISOString()
    );
  });

  it.each([
    ["active", ["active", "solutionSave"]],
    ["inactive", ["inactive"]],
    ["submitted", ["submitted"]],
  ] as const)("filters by activityStatus=%s", async (status, expected) => {
    const body = await list(`&activityStatus=${status}`);
    expect(body.pagination.total).toBe(expected.length);
    expect(body.data.map((r) => r.workSessionId).sort()).toEqual(
      expected.map((k) => sessions[k]).sort()
    );
    expect(body.data.every((r) => r.activityStatus === status)).toBe(true);
  });

  it("exposes the inactivity threshold so the UI can explain it", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeId}/work-sessions`,
      headers: { cookie: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { inactivityThresholdHours: number }).inactivityThresholdHours).toBe(
      24
    );
  });

  it("counts a staff reopen as a fresh start for the inactivity clock", async () => {
    const reopen = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${sessions.submitted}/reopen`,
      headers: { cookie: teacherCookie },
    });
    expect(reopen.statusCode).toBe(200);

    const body = await list();
    const row = body.data.find((r) => r.workSessionId === sessions.submitted)!;
    expect(row.endedAt).toBeNull();
    expect(row.activityStatus).toBe("active");

    const active = await list("&activityStatus=active");
    expect(active.data.map((r) => r.workSessionId)).toContain(sessions.submitted);
  });

  it("rejects an unknown status filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${challengeId}/work-sessions?activityStatus=closed`,
      headers: { cookie: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("never closes idle sessions (endedAt stays null)", async () => {
    await list("&activityStatus=inactive");
    const [row] = await db
      .select({ endedAt: workSession.endedAt })
      .from(workSession)
      .where(eq(workSession.id, sessions.inactive));
    expect(row!.endedAt).toBeNull();
  });

  it("includes the status in the staff session detail", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/work-sessions/${sessions.inactive}`,
      headers: { cookie: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { activityStatus: string; lastActivityAt: string } };
    expect(body.data.activityStatus).toBe("inactive");
    expect(body.data.lastActivityAt).toBe(inactiveLastMessageAt.toISOString());
  });

  it("includes the status in the student's by-challenge view", async () => {
    const studentCookie = await loginAs({
      email: activeStudent.email,
      password: TEST_PASSWORD,
    });
    const res = await app.inject({
      method: "GET",
      url: `/v1/work-sessions/by-challenge?challengeId=${challengeId}`,
      headers: { cookie: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { id: string; activityStatus: string } };
    expect(body.data.id).toBe(sessions.active);
    expect(body.data.activityStatus).toBe("active");
  });
});
