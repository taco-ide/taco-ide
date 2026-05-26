/**
 * Tests for reference solution endpoints: list, PUT manual override,
 * POST regenerate with 409/429 guards, and DELETE.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challengeReferenceSolution,
  challenge,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createUser,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

// Mock the LLM so regenerate doesn't hit a real service
vi.mock("../../../../../agents/teachers-companion/reference-solution", () => {
  const realModule = vi.importActual(
    "../../../../../agents/teachers-companion/reference-solution",
  );
  return {
    generateReferenceSolutions: vi.fn(async (challengeId, kinds) => {
      // Simulate completion without calling LLM
      for (const kind of kinds || ["brute_force", "refined"]) {
        await db
          .update(challengeReferenceSolution)
          .set({
            code: `# mock code for ${kind}`,
            status: "complete",
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(challengeReferenceSolution.challengeId, challengeId),
              eq(challengeReferenceSolution.kind, kind),
            ),
          );
      }
    }),
  };
});

describe("reference solutions", () => {
  let app: FastifyInstance;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let classroom: Awaited<ReturnType<typeof createClassroom>>;
  let challengeRow: Awaited<ReturnType<typeof createChallenge>>;
  let teacherCookie: string;

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
    challengeRow = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });

    teacherCookie = await loginAs({
      email: teacher.email,
      password: TEST_PASSWORD,
    });
  });

  describe("PUT /:kind (manual override)", () => {
    it("creates a solution with createdBy=manual, status=complete", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/brute_force`,
        headers: { cookie: teacherCookie },
        payload: {
          code: "print(1)",
          language: "python",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.kind).toBe("brute_force");
      expect(body.data.code).toBe("print(1)");
      expect(body.data.status).toBe("complete");
      expect(body.data.createdBy).toBe("manual");
      expect(body.data.generatedAt).toBeTruthy();

      // Verify in DB
      const [row] = await db
        .select()
        .from(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeRow.id),
            eq(challengeReferenceSolution.kind, "brute_force"),
          ),
        );
      expect(row).toBeDefined();
      expect(row!.createdBy).toBe("manual");
      expect(row!.status).toBe("complete");
    });

    it("upserts (updates if exists)", async () => {
      // First insert
      await app.inject({
        method: "PUT",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/refined`,
        headers: { cookie: teacherCookie },
        payload: { code: "version 1" },
      });

      // Update
      const res = await app.inject({
        method: "PUT",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/refined`,
        headers: { cookie: teacherCookie },
        payload: { code: "version 2" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.data.code).toBe("version 2");

      // Verify only one row exists
      const rows = await db
        .select()
        .from(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeRow.id),
            eq(challengeReferenceSolution.kind, "refined"),
          ),
        );
      expect(rows.length).toBe(1);
      expect(rows[0]!.code).toBe("version 2");
    });
  });

  describe("GET / (list)", () => {
    it("returns empty array when no solutions exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("returns all solutions for challenge", async () => {
      // Insert two solutions
      await db.insert(challengeReferenceSolution).values({
        id: "1",
        challengeId: challengeRow.id,
        kind: "brute_force",
        code: "brute",
        status: "complete",
        createdBy: "manual",
        generatedAt: new Date(),
      });
      await db.insert(challengeReferenceSolution).values({
        id: "2",
        challengeId: challengeRow.id,
        kind: "refined",
        code: "refined",
        status: "complete",
        createdBy: "ai",
        generatedAt: new Date(),
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.data.length).toBe(2);
      expect(body.data[0].kind).toBe("brute_force");
      expect(body.data[1].kind).toBe("refined");
    });
  });

  describe("POST /:kind/regenerate", () => {
    it("regenerates and returns updated solution", async () => {
      // POST regenerate on non-existent row creates it
      const res = await app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/brute_force/regenerate`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.data.status).toBe("complete");
      expect(body.data.code).toBeTruthy(); // Mock fills this in
    });

    it("returns 409 if already running", async () => {
      // Create a row with status=running
      await db.insert(challengeReferenceSolution).values({
        id: "running-test",
        challengeId: challengeRow.id,
        kind: "refined",
        status: "running",
        createdBy: "ai",
      });

      const res = await app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/refined/regenerate`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.message).toContain("já em execução");
    });

    it("returns 429 if last generation was less than 60s ago", async () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 5_000); // 5 seconds ago

      // Create a completed solution with recent generatedAt
      await db.insert(challengeReferenceSolution).values({
        id: "cooldown-test",
        challengeId: challengeRow.id,
        kind: "refined",
        status: "complete",
        code: "old code",
        createdBy: "ai",
        generatedAt: recentTime,
      });

      const res = await app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/refined/regenerate`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json() as any;
      expect(body.message).toContain("Aguarde");
      expect(body.message).toContain("s");
    });

    it("allows regenerate after cooldown expires", async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 70_000); // 70 seconds ago

      await db.insert(challengeReferenceSolution).values({
        id: "expired-cooldown",
        challengeId: challengeRow.id,
        kind: "brute_force",
        status: "complete",
        code: "old",
        createdBy: "ai",
        generatedAt: oldTime,
      });

      const res = await app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/brute_force/regenerate`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
    });
  });

  describe("DELETE /:kind", () => {
    it("deletes a solution", async () => {
      await db.insert(challengeReferenceSolution).values({
        id: "delete-test",
        challengeId: challengeRow.id,
        kind: "refined",
        status: "complete",
        createdBy: "manual",
      });

      const res = await app.inject({
        method: "DELETE",
        url: `/v1/challenges/${challengeRow.id}/reference-solutions/refined`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);

      // Verify deleted
      const [row] = await db
        .select()
        .from(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeRow.id),
            eq(challengeReferenceSolution.kind, "refined"),
          ),
        );
      expect(row).toBeUndefined();
    });
  });
});
