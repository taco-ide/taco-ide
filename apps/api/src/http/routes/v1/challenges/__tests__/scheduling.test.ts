import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs, setActiveOrg } from "../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";
import { db } from "@repo/infra/db";
import { challenge } from "@repo/infra/db/schema";
import { eq, sql } from "drizzle-orm";
import { isScheduleWindowViolation } from "../update";

const RELEASE = "2026-08-01T12:00:00.000Z";
const DUE = "2026-08-15T23:59:00.000Z";

describe("challenge scheduling (releaseAt / dueAt / latePolicy)", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let teacherCookie: string;
  let classroom: Awaited<ReturnType<typeof createClassroom>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    org = await createOrg();
    teacher = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    teacherCookie = await loginAs({
      email: teacher.email,
      password: TEST_PASSWORD,
    });
    teacherCookie = await setActiveOrg({
      cookie: teacherCookie,
      organizationId: org.id,
    });
  });

  describe("POST /v1/challenges", () => {
    function createPayload(overrides: Record<string, unknown> = {}) {
      return {
        title: "Scheduled challenge",
        difficulty: "easy",
        classroomId: classroom.id,
        generateReferenceSolutions: false,
        ...overrides,
      };
    }

    it("persists and returns releaseAt, dueAt and latePolicy", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({
          releaseAt: RELEASE,
          dueAt: DUE,
          latePolicy: "block",
        }),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json() as {
        data: { releaseAt: string; dueAt: string; latePolicy: string };
      };
      expect(body.data.releaseAt).toBe(RELEASE);
      expect(body.data.dueAt).toBe(DUE);
      expect(body.data.latePolicy).toBe("block");
    });

    it("defaults to null window and allow_late when fields are omitted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json() as {
        data: { releaseAt: string | null; dueAt: string | null; latePolicy: string };
      };
      expect(body.data.releaseAt).toBeNull();
      expect(body.data.dueAt).toBeNull();
      expect(body.data.latePolicy).toBe("allow_late");
    });

    it("normalizes offset timestamps to UTC", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({ releaseAt: "2026-08-01T09:00:00.000-03:00" }),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json() as { data: { releaseAt: string } };
      expect(body.data.releaseAt).toBe(RELEASE);
    });

    it("rejects dueAt <= releaseAt with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({ releaseAt: DUE, dueAt: RELEASE }),
      });

      expect(res.statusCode).toBe(400);

      const equalRes = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({ releaseAt: RELEASE, dueAt: RELEASE }),
      });

      expect(equalRes.statusCode).toBe(400);
    });

    it("rejects non-ISO dates with 400 (Zod)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({ releaseAt: "15/08/2026 10:00" }),
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects unknown latePolicy with 400 (Zod)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: teacherCookie },
        payload: createPayload({ latePolicy: "penalize" }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /v1/challenges/:id", () => {
    it("updates the scheduling fields", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
        payload: { releaseAt: RELEASE, dueAt: DUE, latePolicy: "block" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        data: { releaseAt: string; dueAt: string; latePolicy: string };
      };
      expect(body.data.releaseAt).toBe(RELEASE);
      expect(body.data.dueAt).toBe(DUE);
      expect(body.data.latePolicy).toBe("block");
    });

    it("validates the window against existing values when patching one bound", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
      });

      // dueAt before the stored releaseAt → invalid window
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
        payload: { dueAt: "2026-07-01T00:00:00.000Z" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("allows clearing the window with nulls", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
        payload: { releaseAt: null, dueAt: null },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        data: { releaseAt: string | null; dueAt: string | null };
      };
      expect(body.data.releaseAt).toBeNull();
      expect(body.data.dueAt).toBeNull();
    });

    it("validates releaseAt against the stored dueAt", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        dueAt: new Date(DUE),
      });

      // releaseAt after the stored dueAt → invalid window
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
        payload: { releaseAt: "2026-09-01T00:00:00.000Z" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /v1/challenges/:id (clearing one bound)", () => {
    it("accepts clearing dueAt while moving releaseAt past the old dueAt", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
        payload: { dueAt: null, releaseAt: "2026-09-01T00:00:00.000Z" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        data: { releaseAt: string | null; dueAt: string | null };
      };
      expect(body.data.releaseAt).toBe("2026-09-01T00:00:00.000Z");
      expect(body.data.dueAt).toBeNull();
    });
  });

  describe("database constraints", () => {
    it("rejects an inverted window written outside the API", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
      });

      const err = await db
        .update(challenge)
        .set({ dueAt: new Date("2026-07-01T00:00:00.000Z") })
        .where(eq(challenge.id, ch.id))
        .then(
          () => null,
          (e: unknown) => e
        );

      // PATCH relies on recognising this exact driver error to answer 400.
      expect(isScheduleWindowViolation(err)).toBe(true);
    });

    it("rejects an unknown late_policy written outside the API", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
      });

      await expect(
        db.execute(
          sql`UPDATE challenge SET late_policy = 'penalize' WHERE id = ${ch.id}`
        )
      ).rejects.toThrow();
    });

    it("never stores an inverted window under concurrent PATCHes", async () => {
      // Each PATCH is valid against the original row (Aug 1 – Aug 15), but
      // together they would invert it. Whichever loses — at the app check or
      // the DB CHECK constraint — must get a 400, never a 500.
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
      });

      const [r1, r2] = await Promise.all([
        app.inject({
          method: "PATCH",
          url: `/v1/challenges/${ch.id}`,
          headers: { cookie: teacherCookie },
          payload: { releaseAt: "2026-08-12T00:00:00.000Z" },
        }),
        app.inject({
          method: "PATCH",
          url: `/v1/challenges/${ch.id}`,
          headers: { cookie: teacherCookie },
          payload: { dueAt: "2026-08-10T00:00:00.000Z" },
        }),
      ]);

      expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 400]);
      const [row] = await db
        .select({ releaseAt: challenge.releaseAt, dueAt: challenge.dueAt })
        .from(challenge)
        .where(eq(challenge.id, ch.id));
      expect(row!.dueAt! > row!.releaseAt!).toBe(true);
    });
  });

  describe("read endpoints", () => {
    it("GET /v1/challenges/:id exposes the scheduling fields", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
        latePolicy: "block",
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/challenges/${ch.id}`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        data: { releaseAt: string; dueAt: string; latePolicy: string };
      };
      expect(body.data.releaseAt).toBe(RELEASE);
      expect(body.data.dueAt).toBe(DUE);
      expect(body.data.latePolicy).toBe("block");
    });

    it("GET /v1/challenges list items expose the scheduling fields", async () => {
      const ch = await createChallenge({
        createdByUserId: teacher.id,
        classroomId: classroom.id,
        releaseAt: new Date(RELEASE),
        dueAt: new Date(DUE),
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/challenges?classroomId=${classroom.id}`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        data: Array<{ id: string; releaseAt: string | null; dueAt: string | null; latePolicy: string }>;
      };
      const item = body.data.find((c) => c.id === ch.id);
      expect(item).toBeDefined();
      expect(item!.releaseAt).toBe(RELEASE);
      expect(item!.dueAt).toBe(DUE);
      expect(item!.latePolicy).toBe("allow_late");
    });
  });
});
