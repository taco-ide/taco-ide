import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
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

describe("PATCH /v1/challenges/:id", () => {
  let app: FastifyInstance;
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let teacherB: Awaited<ReturnType<typeof createUser>>;
  let coordinator: Awaited<ReturnType<typeof createUser>>;
  let teacherACookie: string;
  let teacherBCookie: string;
  let coordCookie: string;
  let challengeA: Awaited<ReturnType<typeof createChallenge>>;
  let classroom: Awaited<ReturnType<typeof createClassroom>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    org = await createOrg();
    teacherA = await createUser();
    teacherB = await createUser();
    coordinator = await createUser();
    await addMember(teacherA.id, org.id, "teacher");
    await addMember(teacherB.id, org.id, "teacher");
    await addMember(coordinator.id, org.id, "coordinator");

    classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacherA.id,
    });
    challengeA = await createChallenge({
      createdByUserId: teacherA.id,
      classroomId: classroom.id,
    });

    teacherACookie = await loginAs({ email: teacherA.email, password: TEST_PASSWORD });
    teacherBCookie = await loginAs({ email: teacherB.email, password: TEST_PASSWORD });
    coordCookie = await loginAs({ email: coordinator.email, password: TEST_PASSWORD });
  });

  it("teacher can edit their own challenge (title, description, difficulty, tags)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: teacherACookie },
      payload: {
        title: "Updated title",
        description: "Updated description",
        difficulty: "medium",
        tags: ["t1", "t2"],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { title: string; description: string; difficulty: string; tags: string[] } };
    expect(body.data.title).toBe("Updated title");
    expect(body.data.description).toBe("Updated description");
    expect(body.data.difficulty).toBe("medium");
    expect(body.data.tags).toEqual(["t1", "t2"]);
  });

  it("teacher cannot edit another teacher's challenge content (403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: teacherBCookie },
      payload: { title: "Hijack" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("coordinator can edit any challenge in the org", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: coordCookie },
      payload: { title: "Coord edit" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { title: string } };
    expect(body.data.title).toBe("Coord edit");
  });

  it("possibleSolutions round-trips as a string", async () => {
    const text = "def solve():\n    return 42\n";
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: teacherACookie },
      payload: { possibleSolutions: text },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { possibleSolutions: string | null } };
    expect(body.data.possibleSolutions).toBe(text);
  });

  it("returns 404 for unknown id", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/00000000-0000-0000-0000-000000000000`,
      headers: { cookie: teacherACookie },
      payload: { title: "x" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("rejects classroom reassignment when already assigned", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: coordCookie },
      payload: { classroomId: classroom.id },
    });

    // challenge is already on `classroom`; reassign to another is blocked
    // even when target == current. The guard is "remove first".
    expect(res.statusCode).toBe(400);
  });

  it("allows clearing classroomId to null", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeA.id}`,
      headers: { cookie: coordCookie },
      payload: { classroomId: null },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { classroomId: string | null } };
    expect(body.data.classroomId).toBeNull();
  });
});
