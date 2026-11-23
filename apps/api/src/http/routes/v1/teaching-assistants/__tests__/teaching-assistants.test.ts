import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeTeachingAssistant,
  model,
  teachingAssistant,
  workSession,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createTeachingAssistant,
  createUser,
  createWorkSession,
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
  isDefault: boolean;
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
  let studentA: Awaited<ReturnType<typeof createUser>>;
  let classroomA: Awaited<ReturnType<typeof createClassroom>>;
  let teacherA2: Awaited<ReturnType<typeof createUser>>;
  let cookies: {
    student: string;
    teacher: string;
    teacher2: string;
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
    studentA = student;
    teacherA = await createUser();
    const coordinator = await createUser();
    const coordinatorB = await createUser();
    const platformAdmin = await createUser({ isPlatformAdmin: true });
    teacherA2 = await createUser();
    await addMember(student.id, orgA.id, "student");
    await addMember(teacherA.id, orgA.id, "teacher");
    await addMember(teacherA2.id, orgA.id, "teacher");
    await addMember(coordinator.id, orgA.id, "coordinator");
    await addMember(coordinatorB.id, orgB.id, "coordinator");

    classroomA = await createClassroom({
      organizationId: orgA.id,
      teacherUserId: teacherA.id,
    });

    cookies = {
      student: await login(student),
      teacher: await login(teacherA),
      teacher2: await login(teacherA2),
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

  const patchTa = (
    cookie: string,
    id: string,
    payload: Record<string, unknown>
  ) =>
    app.inject({
      method: "PATCH",
      url: `/v1/teaching-assistants/${id}`,
      headers: { cookie },
      payload,
    });

  const deleteTa = (cookie: string, id: string) =>
    app.inject({
      method: "DELETE",
      url: `/v1/teaching-assistants/${id}`,
      headers: { cookie },
    });

  const patchChallenge = (
    cookie: string,
    id: string,
    payload: Record<string, unknown>
  ) =>
    app.inject({
      method: "PATCH",
      url: `/v1/challenges/${id}`,
      headers: { cookie },
      payload,
    });

  const sessionTa = async (id: string) => {
    const [row] = await db
      .select({ teachingAssistantId: workSession.teachingAssistantId })
      .from(workSession)
      .where(eq(workSession.id, id));
    return row!.teachingAssistantId;
  };

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
      const res = await list(
        cookies.platformAdmin,
        `?organizationId=${orgB.id}`
      );
      expect(res.statusCode).toBe(200);
      expect((res.json().data as TA[]).map((t) => t.id)).toEqual([taB.id]);
    });

    it("filters inactive assistants with status=active", async () => {
      await db
        .update(teachingAssistant)
        .set({ isActive: false })
        .where(eq(teachingAssistant.id, taA.id));
      expect(
        (await list(cookies.teacher, "?status=active")).json().data
      ).toEqual([]);
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
      const own = await createTeachingAssistant({ organizationId: orgA.id });
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/teaching-assistants/${own.id}`,
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
        headers: { cookie: cookies.coordinator },
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
        headers: { cookie: cookies.coordinator },
        payload: { modelParameters: { top_p: 0.7 } },
      });
      const [again] = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, taA.id));
      expect(again!.modelId).toBe(updatedTa!.modelId);
    });

    it("keeps the model link when modelParameters is omitted (rename)", async () => {
      const res = await patchTa(cookies.coordinator, taA.id, {
        alias: "Renamed",
      });
      expect(res.statusCode).toBe(200);
      const [row] = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, taA.id));
      expect(row!.modelId).toBe(taA.modelId);
    });

    it("null modelParameters restores the shared model instead of detaching", async () => {
      // Clearing while on the shared row keeps the link.
      expect(
        (await patchTa(cookies.coordinator, taA.id, { modelParameters: null }))
          .statusCode
      ).toBe(200);
      const modelIdOf = async () =>
        (
          await db
            .select({ modelId: teachingAssistant.modelId })
            .from(teachingAssistant)
            .where(eq(teachingAssistant.id, taA.id))
        )[0]!.modelId;
      expect(await modelIdOf()).toBe(taA.modelId);

      // Custom parameters move to a private row...
      await patchTa(cookies.coordinator, taA.id, {
        modelParameters: { temperature: 0.2 },
      });
      expect(await modelIdOf()).not.toBe(taA.modelId);

      // ...and clearing them goes back to the shared row it came from.
      const res = await patchTa(cookies.coordinator, taA.id, {
        modelParameters: null,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.modelParameters).toBeNull();
      expect(await modelIdOf()).toBe(taA.modelId);
    });
  });

  describe("shared assistants (teacher vs coordinator)", () => {
    it("teachers cannot edit or deactivate the organization default", async () => {
      // taA is orgA's oldest active assistant, hence its default.
      const newer = await createTeachingAssistant({ organizationId: orgA.id });
      const flags = Object.fromEntries(
        ((await list(cookies.teacher)).json().data as TA[]).map((t) => [
          t.id,
          t.isDefault,
        ])
      );
      expect(flags).toEqual({ [taA.id]: true, [newer.id]: false });
      for (const payload of [
        { systemPrompt: "rewrite" },
        { isActive: false },
      ]) {
        const res = await patchTa(cookies.teacher, taA.id, payload);
        expect(res.statusCode, JSON.stringify(payload)).toBe(403);
      }
      expect(
        (await patchTa(cookies.coordinator, taA.id, { systemPrompt: "ok" }))
          .statusCode
      ).toBe(200);
    });

    it("teachers cannot activate an assistant that would become the default", async () => {
      const older = await createTeachingAssistant({ organizationId: orgA.id });
      await db
        .update(teachingAssistant)
        .set({ isActive: false, createdAt: new Date("2000-01-01") })
        .where(eq(teachingAssistant.id, older.id));
      expect(
        (await patchTa(cookies.teacher, older.id, { isActive: true }))
          .statusCode
      ).toBe(403);
      expect(
        (await patchTa(cookies.coordinator, older.id, { isActive: true }))
          .statusCode
      ).toBe(200);
    });

    it("teachers edit assistants used only by challenges they manage", async () => {
      const own = await createTeachingAssistant({ organizationId: orgA.id });
      const ch = await createChallenge({
        createdByUserId: teacherA.id,
        classroomId: classroomA.id,
      });
      await linkChallengeToTa(ch.id, own.id);
      expect(
        (await patchTa(cookies.teacher, own.id, { systemPrompt: "mine" }))
          .statusCode
      ).toBe(200);
      expect(
        (await patchTa(cookies.teacher, own.id, { isActive: false })).statusCode
      ).toBe(200);
    });

    it("teachers cannot edit assistants used by other teachers' challenges", async () => {
      const shared = await createTeachingAssistant({ organizationId: orgA.id });
      const otherClassroom = await createClassroom({
        organizationId: orgA.id,
        teacherUserId: teacherA2.id,
      });
      const ch = await createChallenge({
        createdByUserId: teacherA2.id,
        classroomId: otherClassroom.id,
      });
      await linkChallengeToTa(ch.id, shared.id);

      for (const payload of [{ systemPrompt: "hijack" }, { isActive: false }]) {
        const res = await patchTa(cookies.teacher, shared.id, payload);
        expect(res.statusCode, JSON.stringify(payload)).toBe(403);
      }
      // The responsible teacher and coordinators still can.
      expect(
        (await patchTa(cookies.teacher2, shared.id, { systemPrompt: "mine" }))
          .statusCode
      ).toBe(200);
      expect(
        (await patchTa(cookies.coordinator, shared.id, { isActive: false }))
          .statusCode
      ).toBe(200);
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
      expect(
        (await list(cookies.teacher)).json().data[0].activeChallengeCount
      ).toBe(1);

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

    it("refuses deleting an assistant still serving work sessions (409)", async () => {
      // A challenge without a link falls back to the default assistant, so
      // its sessions reference taA although no challenge links to it.
      const ch = await createChallenge({
        createdByUserId: teacherA.id,
        classroomId: classroomA.id,
        title: "Fallback challenge",
      });
      await createWorkSession({
        userId: studentA.id,
        challengeId: ch.id,
        classroomId: classroomA.id,
        teachingAssistantId: taA.id,
      });
      const res = await deleteTa(cookies.coordinator, taA.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().errors.challenges).toEqual(["Fallback challenge"]);
    });

    it("switching a challenge's assistant moves its sessions, then the old one can be deleted", async () => {
      const ch = await createChallenge({
        createdByUserId: teacherA.id,
        classroomId: classroomA.id,
      });
      await linkChallengeToTa(ch.id, taA.id);
      const submitted = await createWorkSession({
        userId: studentA.id,
        challengeId: ch.id,
        classroomId: classroomA.id,
        teachingAssistantId: taA.id,
        endedAt: new Date(),
      });
      const otherStudent = await createUser();
      await addMember(otherStudent.id, orgA.id, "student");
      const inProgress = await createWorkSession({
        userId: otherStudent.id,
        challengeId: ch.id,
        classroomId: classroomA.id,
        teachingAssistantId: taA.id,
      });
      const next = await createTeachingAssistant({ organizationId: orgA.id });

      const res = await patchChallenge(cookies.teacher, ch.id, {
        teachingAssistantId: next.id,
      });
      expect(res.statusCode).toBe(200);
      expect(await sessionTa(inProgress.id)).toBe(next.id);
      // Submitted sessions can be reopened, so they move too.
      expect(await sessionTa(submitted.id)).toBe(next.id);

      expect((await deleteTa(cookies.coordinator, taA.id)).statusCode).toBe(
        204
      );
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
      const inactive = await createTeachingAssistant({
        organizationId: orgA.id,
      });
      await db
        .update(teachingAssistant)
        .set({ isActive: false })
        .where(eq(teachingAssistant.id, inactive.id));
      expect(
        (await createChallengeReq({ teachingAssistantId: inactive.id }))
          .statusCode
      ).toBe(400);
    });

    it("clearing a challenge's assistant moves its sessions to the organization default", async () => {
      const chosen = await createTeachingAssistant({ organizationId: orgA.id });
      const ch = (
        await createChallengeReq({ teachingAssistantId: chosen.id })
      ).json().data as { id: string };
      const ws = await createWorkSession({
        userId: studentA.id,
        challengeId: ch.id,
        classroomId: classroomA.id,
        teachingAssistantId: chosen.id,
      });
      expect(
        (
          await patchChallenge(cookies.teacher, ch.id, {
            teachingAssistantId: null,
          })
        ).statusCode
      ).toBe(200);
      expect(await sessionTa(ws.id)).toBe(taA.id);
    });

    it("new work sessions use the same default as challenge creation", async () => {
      // Inserted after taA but older, so it is the organization default.
      const older = await createTeachingAssistant({ organizationId: orgA.id });
      await db
        .update(teachingAssistant)
        .set({ createdAt: new Date("2000-01-01") })
        .where(eq(teachingAssistant.id, older.id));
      const ch = await createChallenge({
        createdByUserId: teacherA.id,
        classroomId: classroomA.id,
      });
      const res = await app.inject({
        method: "POST",
        url: "/v1/work-sessions",
        headers: { cookie: cookies.coordinator },
        payload: { challengeId: ch.id },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.teachingAssistantId).toBe(older.id);
    });

    it("drops an other-organization link when an unassigned challenge moves to a classroom", async () => {
      const ch = (await createChallengeReq({})).json().data as { id: string };
      expect(await challengeTas(ch.id)).toEqual([taA.id]);
      expect(
        (await patchChallenge(cookies.teacher, ch.id, { classroomId: null }))
          .statusCode
      ).toBe(200);

      const classroomB = await createClassroom({ organizationId: orgB.id });
      const res = await patchChallenge(cookies.platformAdmin, ch.id, {
        classroomId: classroomB.id,
      });
      expect(res.statusCode).toBe(200);
      const [link] = await db
        .select()
        .from(challengeTeachingAssistant)
        .where(eq(challengeTeachingAssistant.challengeId, ch.id));
      expect(link).toBeUndefined();

      // Moving back into the same organization keeps a valid link.
      const ch2 = (await createChallengeReq({})).json().data as { id: string };
      await patchChallenge(cookies.teacher, ch2.id, { classroomId: null });
      await patchChallenge(cookies.teacher, ch2.id, {
        classroomId: classroomA.id,
      });
      expect(await challengeTas(ch2.id)).toEqual([taA.id]);
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
