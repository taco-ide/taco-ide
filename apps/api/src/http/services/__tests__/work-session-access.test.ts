import { describe, it, expect, beforeEach } from "vitest";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../work-session-access";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createUser,
} from "../../../test/helpers/factories";

type AuthUser = Parameters<typeof assertCanListChallengeWorkSessions>[0];

function fakeUser(opts: { id: string; activeOrganizationId: string | null }): AuthUser {
  return {
    id: opts.id,
    email: `${opts.id}@test.local`,
    name: "test",
    image: null,
    emailVerified: true,
    isActive: true,
    isPlatformAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeOrganizationId: opts.activeOrganizationId,
    activeOrganizationName: null,
    role: null,
  } as AuthUser;
}

describe("work-session-access: assertCanListChallengeWorkSessions", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let creatorTeacher: Awaited<ReturnType<typeof createUser>>;
  let leadTeacher: Awaited<ReturnType<typeof createUser>>;
  let unrelatedTeacher: Awaited<ReturnType<typeof createUser>>;
  let coordinator: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let cls: Awaited<ReturnType<typeof createClassroom>>;
  let ch: Awaited<ReturnType<typeof createChallenge>>;

  beforeEach(async () => {
    org = await createOrg();
    creatorTeacher = await createUser();
    leadTeacher = await createUser();
    unrelatedTeacher = await createUser();
    coordinator = await createUser();
    student = await createUser();

    await addMember(creatorTeacher.id, org.id, "teacher");
    await addMember(leadTeacher.id, org.id, "teacher");
    await addMember(unrelatedTeacher.id, org.id, "teacher");
    await addMember(coordinator.id, org.id, "coordinator");
    await addMember(student.id, org.id, "student");

    cls = await createClassroom({
      organizationId: org.id,
      teacherUserId: leadTeacher.id,
    });
    ch = await createChallenge({
      createdByUserId: creatorTeacher.id,
      classroomId: cls.id,
    });
  });

  it("allows the challenge creator (teacher)", async () => {
    const ctx = await loadChallengeWorkAccessContext(ch.id);
    expect(ctx).not.toBeNull();
    const result = await assertCanListChallengeWorkSessions(
      fakeUser({ id: creatorTeacher.id, activeOrganizationId: org.id }),
      ctx!
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows the lead teacher of the classroom", async () => {
    const ctx = await loadChallengeWorkAccessContext(ch.id);
    const result = await assertCanListChallengeWorkSessions(
      fakeUser({ id: leadTeacher.id, activeOrganizationId: org.id }),
      ctx!
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows coordinators in the org", async () => {
    const ctx = await loadChallengeWorkAccessContext(ch.id);
    const result = await assertCanListChallengeWorkSessions(
      fakeUser({ id: coordinator.id, activeOrganizationId: org.id }),
      ctx!
    );
    expect(result).toEqual({ ok: true });
  });

  it("denies an unrelated teacher (not creator, not lead)", async () => {
    const ctx = await loadChallengeWorkAccessContext(ch.id);
    const result = await assertCanListChallengeWorkSessions(
      fakeUser({ id: unrelatedTeacher.id, activeOrganizationId: org.id }),
      ctx!
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("denies students", async () => {
    const ctx = await loadChallengeWorkAccessContext(ch.id);
    const result = await assertCanListChallengeWorkSessions(
      fakeUser({ id: student.id, activeOrganizationId: org.id }),
      ctx!
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns null context for an unknown challenge id", async () => {
    const ctx = await loadChallengeWorkAccessContext(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(ctx).toBeNull();
  });

  describe("unclassified challenges", () => {
    it("allows only the creator (even for coordinators)", async () => {
      const unclassifiedCh = await createChallenge({
        createdByUserId: creatorTeacher.id,
        classroomId: null,
      });
      const ctx = await loadChallengeWorkAccessContext(unclassifiedCh.id);

      const creatorResult = await assertCanListChallengeWorkSessions(
        fakeUser({ id: creatorTeacher.id, activeOrganizationId: org.id }),
        ctx!
      );
      expect(creatorResult).toEqual({ ok: true });

      const coordResult = await assertCanListChallengeWorkSessions(
        fakeUser({ id: coordinator.id, activeOrganizationId: org.id }),
        ctx!
      );
      expect(coordResult.ok).toBe(false);
    });
  });
});
