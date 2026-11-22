import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { challenge, model, teachingAssistant } from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createTeachingAssistant,
  createUser,
  linkChallengeToTa,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

vi.mock("../../../../../agents/teachers-companion/reference-solution", () => ({
  generateReferenceSolutions: vi.fn(),
}));

type TA = {
  id: string;
  alias: string;
  version: number;
  systemPrompt: string;
  description: string | null;
  targetAudience: string | null;
  isActive: boolean;
  organizationId: string | null;
  modelParameters: Record<string, number> | null;
  activeChallengeCount: number;
};

const login = (u: { email: string }) =>
  loginAs({ email: u.email, password: TEST_PASSWORD });

describe("/v1/teaching-assistants", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let orgA: Awaited<ReturnType<typeof createOrg>>;
  let orgB: Awaited<ReturnType<typeof createOrg>>;
  let taA: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let taB: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let classroomA: Awaited<ReturnType<typeof createClassroom>>;
  let cookies: {
    student: string;
    teacher: string;
    coordinator: string;
    coordinatorB: string;
    platformAdmin: string;
  };

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    orgA = await createOrg();
    orgB = await createOrg();
    taA = await createTeachingAssistant({ organizationId: orgA.id });
    taB = await createTeachingAssistant({ organizationId: orgB.id });

    const student = await createUser();
    teacherA = await createUser();
    const coordinator = await createUser();
    const coordinatorB = await createUser();
    const platformAdmin = await createUser({ isPlatformAdmin: true });
    await addMember(student.id, orgA.id, "student");
    await addMember(teacherA.id, orgA.id, "teacher");
    await addMember(coordinator.id, orgA.id, "coordinator");
    await addMember(coordinatorB.id, orgB.id, "coordinator");

    classroomA = await createClassroom({
      organizationId: orgA.id,
      teacherUserId: teacherA.id,
    });

    cookies = {
      student: await login(student),
      teacher: await login(teacherA),
      coordinator: await login(coordinator),
      coordinatorB: await login(coordinatorB),
      platformAdmin: await login(platformAdmin),
    };
  });

  const list = (cookie: string, query = "") =>
    app.inject({
      method: "GET",
      url: `/v1/teaching-assistants${query}`,
      headers: { cookie },
    });

  const create = (cookie: string, payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/v1/teaching-assistants",
      headers: { cookie },
      payload,
    });

  describe("read access", () => {
    it("lists only the active organization's assistants for staff", async () => {
      const res = await list(cookies.teacher);
      expect(res.statusCode).toBe(200);
      const ids = (res.json().data as TA[]).map((t) => t.id);
      expect(ids).toEqual([taA.id]);
    });

    it("refuses students (403)", async () => {
      expect((await list(cookies.student)).statusCode).toBe(403);
      const res = await app.inject({
        method: "GET",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.student },
      });
      expect(res.statusCode).toBe(403);
    });

    it("refuses another organization's list and detail (403)", async () => {
      expect(
        (await list(cookies.teacher, `?organizationId=${orgB.id}`)).statusCode
      ).toBe(403);
      const res = await app.inject({
        method: "GET",
        url: `/v1/teaching-assistants/${taB.id}`,
        headers: { cookie: cookies.coordinator },
      });
      expect(res.statusCode).toBe(403);
    });

    it("lets platform admins list any active organization", async () => {
      const res = await list(cookies.platformAdmin, `?organizationId=${orgB.id}`);
      expect(res.statusCode).toBe(200);
      expect((res.json().data as TA[]).map((t) => t.id)).toEqual([taB.id]);
    });

    it("filters inactive assistants with status=active", async () => {
      await db
        .update(teachingAssistant)
        .set({ isActive: false })
        .where(eq(teachingAssistant.id, taA.id));
      expect((await list(cookies.teacher, "?status=active")).json().data).toEqual(
        []
      );
      expect((await list(cookies.teacher)).json().data).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("teacher creates an assistant in the active organization", async () => {
      const res = await create(cookies.teacher, {
        alias: "Socratic Tutor",
        systemPrompt: "Ask guiding questions.",
        description: "For beginners",
        targetAudience: "beginner",
        modelParameters: { temperature: 0.3, max_tokens: 800 },
      });
      expect(res.statusCode).toBe(201);
      const ta = res.json().data as TA;
      expect(ta).toMatchObject({
        alias: "Socratic Tutor",
        version: 1,
        isActive: true,
        organizationId: orgA.id,
        targetAudience: "beginner",
        modelParameters: { temperature: 0.3, max_tokens: 800 },
        activeChallengeCount: 0,
      });

      const detail = await app.inject({
        method: "GET",
        url: `/v1/teaching-assistants/${ta.id}`,
        headers: { cookie: cookies.coordinator },
      });
      expect(detail.json().data.modelParameters).toEqual({
        temperature: 0.3,
        max_tokens: 800,
      });
    });

    it("refuses students (403)", async () => {
      const res = await create(cookies.student, {
        alias: "Nope",
        systemPrompt: "x",
      });
      expect(res.statusCode).toBe(403);
    });

    it("refuses creating in an organization the caller does not belong to", async () => {
      const res = await create(cookies.coordinator, {
        organizationId: orgB.id,
        alias: "Intruder",
        systemPrompt: "x",
      });
      expect(res.statusCode).toBe(403);
    });

    it("validates model parameters with the LLM override rules", async () => {
      for (const modelParameters of [
        { temperature: 5 },
        { top_p: -1 },
        { max_tokens: 0 },
        { model: "gpt-5" },
        { seed: 1 },
      ]) {
        const res = await create(cookies.teacher, {
          alias: "Bad params",
          systemPrompt: "x",
          modelParameters,
        });
        expect(res.statusCode, JSON.stringify(modelParameters)).toBe(400);
      }
    });

    it("rejects a duplicate name in the same organization but allows it elsewhere", async () => {
      const dup = await create(cookies.teacher, {
        alias: taA.alias,
        systemPrompt: "x",
      });
      expect(dup.statusCode).toBe(409);

      const other = await create(cookies.coordinatorB, {
        alias: taA.alias,
        systemPrompt: "x",
      });
      expect(other.statusCode).toBe(201);
    });
  });

  describe("update", () => {
    it("teacher updates instructions, parameters and active flag", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.teacher },
        payload: {
          systemPrompt: "New instructions",
          isActive: false,
          modelParameters: { temperature: 1.1 },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        systemPrompt: "New instructions",
        isActive: false,
        modelParameters: { temperature: 1.1 },
      });
    });

    it("does not modify model rows shared with other assistants", async () => {
      const [shared] = await db
        .select()
        .from(model)
        .where(eq(model.id, taA.modelId!));
      const other = await createTeachingAssistant({ organizationId: orgA.id });
      await db
        .update(teachingAssistant)
        .set({ modelId: shared!.id })
        .where(eq(teachingAssistant.id, other.id));

      const res = await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.teacher },
        payload: { modelParameters: { top_p: 0.5 } },
      });
      expect(res.statusCode).toBe(200);

      const [after] = await db
        .select()
        .from(model)
        .where(eq(model.id, shared!.id));
      expect(after!.modelParameters).toBeNull();
      const [updatedTa] = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, taA.id));
      expect(updatedTa!.modelId).not.toBe(shared!.id);

      // A second update reuses the assistant's private row.
      await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.teacher },
        payload: { modelParameters: { top_p: 0.7 } },
      });
      const [again] = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, taA.id));
      expect(again!.modelId).toBe(updatedTa!.modelId);
    });

    it("refuses staff of another organization (403)", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinatorB },
        payload: { systemPrompt: "hijack" },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("delete", () => {
    it("teachers lack the delete permission (403)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.teacher },
      });
      expect(res.statusCode).toBe(403);
    });

    it("refuses deleting an assistant used by active challenges (409)", async () => {
      const ch = await createChallenge({
        createdByUserId: teacherA.id,
        classroomId: classroomA.id,
        title: "Loops 101",
      });
      await linkChallengeToTa(ch.id, taA.id);

      const res = await app.inject({
        method: "DELETE",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinator },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().errors.challenges).toEqual(["Loops 101"]);
      expect((await list(cookies.teacher)).json().data[0].activeChallengeCount).toBe(
        1
      );

      // Deleted challenges no longer block deletion.
      await db
        .update(challenge)
        .set({ deletedAt: new Date() })
        .where(eq(challenge.id, ch.id));
      const ok = await app.inject({
        method: "DELETE",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinator },
      });
      expect(ok.statusCode).toBe(204);
    });

    it("soft deletes: hidden from list/detail, row kept, name reusable", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinator },
      });
      expect(res.statusCode).toBe(204);

      const [row] = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, taA.id));
      expect(row!.deletedAt).not.toBeNull();
      expect(row!.isActive).toBe(false);

      expect((await list(cookies.teacher)).json().data).toEqual([]);
      const detail = await app.inject({
        method: "GET",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.teacher },
      });
      expect(detail.statusCode).toBe(404);
      const patch = await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinator },
        payload: { isActive: true },
      });
      expect(patch.statusCode).toBe(404);

      const again = await create(cookies.teacher, {
        alias: taA.alias,
        systemPrompt: "x",
      });
      expect(again.statusCode).toBe(201);
    });

    it("refuses another organization's coordinator (403)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/teaching-assistants/${taA.id}`,
        headers: { cookie: cookies.coordinatorB },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("challenge assignment", () => {
    const createChallengeReq = (payload: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers: { cookie: cookies.teacher },
        payload: {
          title: "Challenge",
          difficulty: "easy",
          classroomId: classroomA.id,
          generateReferenceSolutions: false,
          ...payload,
        },
      });

    const challengeTas = async (id: string) => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/challenges/${id}`,
        headers: { cookie: cookies.teacher },
      });
      return (res.json().data.teachingAssistants as { id: string }[]).map(
        (t) => t.id
      );
    };

    it("defaults to the organization's oldest active assistant", async () => {
      await createTeachingAssistant({ organizationId: orgA.id });
      const res = await createChallengeReq({});
      expect(res.statusCode).toBe(201);
      expect(res.json().data.teachingAssistantId).toBe(taA.id);
      expect(await challengeTas(res.json().data.id)).toEqual([taA.id]);
    });

    it("uses the chosen assistant", async () => {
      const chosen = await createTeachingAssistant({ organizationId: orgA.id });
      const res = await createChallengeReq({ teachingAssistantId: chosen.id });
      expect(res.statusCode).toBe(201);
      expect(await challengeTas(res.json().data.id)).toEqual([chosen.id]);
    });

    it("rejects assistants from another organization or inactive ones", async () => {
      expect(
        (await createChallengeReq({ teachingAssistantId: taB.id })).statusCode
      ).toBe(400);
      const inactive = await createTeachingAssistant({ organizationId: orgA.id });
      await db
        .update(teachingAssistant)
        .set({ isActive: false })
        .where(eq(teachingAssistant.id, inactive.id));
      expect(
        (await createChallengeReq({ teachingAssistantId: inactive.id }))
          .statusCode
      ).toBe(400);
    });

    it("updates or clears a challenge's assistant", async () => {
      const ch = (await createChallengeReq({})).json().data as { id: string };
      const other = await createTeachingAssistant({ organizationId: orgA.id });

      const patch = (teachingAssistantId: string | null) =>
        app.inject({
          method: "PATCH",
          url: `/v1/challenges/${ch.id}`,
          headers: { cookie: cookies.teacher },
          payload: { teachingAssistantId },
        });

      expect((await patch(taB.id)).statusCode).toBe(400);
      expect(await challengeTas(ch.id)).toEqual([taA.id]);

      const res = await patch(other.id);
      expect(res.statusCode).toBe(200);
      expect(res.json().data.teachingAssistantId).toBe(other.id);
      expect(await challengeTas(ch.id)).toEqual([other.id]);

      expect((await patch(null)).statusCode).toBe(200);
      expect(await challengeTas(ch.id)).toEqual([]);
    });
  });
});
