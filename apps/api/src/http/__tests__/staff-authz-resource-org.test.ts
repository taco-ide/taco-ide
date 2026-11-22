/**
 * Issue #118: staff authorization is evaluated against the role held in the
 * resource's organization, never the caller's active organization. A
 * multi-organization user whose active organization differs from the
 * resource's organization must get the same answer as when that
 * organization is active.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challengeReferenceSolution,
  invitation,
  knowledgeBase,
  member,
  submission,
} from "@repo/infra/db/schema";
import { getApp } from "../../test/helpers/app";
import { loginAs, setActiveOrg } from "../../test/helpers/auth";
import {
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
} from "../../test/helpers/factories";

vi.mock("../../services/embedding", () => ({
  generateEmbedding: vi.fn(async () => [1, ...Array<number>(1535).fill(0)]),
  generateEmbeddings: vi.fn(async () => []),
}));
vi.mock("../../services/file-storage", () => ({
  deleteFile: vi.fn(async () => {}),
  saveFile: vi.fn(async () => {}),
}));
vi.mock("../../agents/teachers-companion/auto-review", () => ({
  runAutoReview: vi.fn(async () => {}),
  startAutoReview: vi.fn(async (submissionId: string) => {
    await db
      .update(submission)
      .set({ autoReviewStatus: "running" })
      .where(eq(submission.id, submissionId));
    return { started: true, done: Promise.resolve() };
  }),
}));
vi.mock("../../agents/teachers-companion/reference-solution", () => ({
  generateReferenceSolutions: vi.fn(async () => {}),
  startReferenceSolutions: vi.fn(async () => ({
    claimed: [],
    done: Promise.resolve(),
  })),
}));

type App = Awaited<ReturnType<typeof getApp>>;
type Role = "student" | "teacher" | "coordinator" | "admin";

describe("staff authorization uses the resource organization (#118)", () => {
  let app: App;
  let orgA: Awaited<ReturnType<typeof createOrg>>;
  let orgB: Awaited<ReturnType<typeof createOrg>>;
  let classroomId: string;
  let challengeId: string;
  let submissionId: string;
  let kbId: string;

  beforeAll(async () => {
    app = await getApp();
  });

  /** Signs in and makes `organizationId` the active organization. */
  async function cookieActiveIn(
    email: string,
    organizationId: string,
  ): Promise<string> {
    const cookie = await loginAs({ email, password: TEST_PASSWORD });
    return setActiveOrg({ cookie, organizationId });
  }

  /** User with `roleA` in org A and `roleB` in org B, active in org B. */
  async function multiOrgUser(roleA: Role | null, roleB: Role) {
    const usr = await createUser();
    if (roleA) await addMember(usr.id, orgA.id, roleA);
    await addMember(usr.id, orgB.id, roleB);
    return { usr, cookie: await cookieActiveIn(usr.email, orgB.id) };
  }

  /** Seeds a classroom/challenge/submission/KB in org A led by `leadId`. */
  async function seedOrgAResources(leadId: string) {
    const cls = await createClassroom({
      organizationId: orgA.id,
      teacherUserId: leadId,
    });
    classroomId = cls.id;
    const ch = await createChallenge({
      createdByUserId: leadId,
      classroomId: cls.id,
    });
    challengeId = ch.id;
    const ta = await createTeachingAssistant({ organizationId: orgA.id });
    await linkChallengeToTa(ch.id, ta.id);
    const learner = await createUser();
    await addMember(learner.id, orgA.id, "student");
    await enrollStudent(learner.id, cls.id);
    const ws = await createWorkSession({
      userId: learner.id,
      challengeId: ch.id,
      classroomId: cls.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    const sub = await createSubmission({
      workSessionId: ws.id,
      challengeId: ch.id,
      studentUserId: learner.id,
    });
    submissionId = sub.id;
    kbId = randomUUID();
    await db.insert(knowledgeBase).values({
      id: kbId,
      classroomId: cls.id,
      organizationId: orgA.id,
      title: "Org A material",
      createdByUserId: leadId,
    });
    await db.insert(challengeReferenceSolution).values({
      id: randomUUID(),
      challengeId: ch.id,
      kind: "brute_force",
      language: "python",
      status: "complete",
      code: "print(1)",
      createdBy: "ai",
    });
  }

  /** Every staff route that used to carry an active-org permission gate. */
  function staffRequests(): Array<{
    name: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    url: () => string;
    payload?: () => Record<string, unknown>;
    ok: number;
  }> {
    const sub = () => `/v1/challenges/${challengeId}/submissions`;
    const ref = () => `/v1/challenges/${challengeId}/reference-solutions`;
    const kb = () => `/v1/knowledge-bases/${kbId}`;
    return [
      { name: "list submissions", method: "GET", url: sub, ok: 200 },
      {
        name: "submission detail",
        method: "GET",
        url: () => `${sub()}/${submissionId}`,
        ok: 200,
      },
      {
        name: "grade submission",
        method: "PUT",
        url: () => `${sub()}/${submissionId}/grade`,
        payload: () => ({ grade: "9" }),
        ok: 200,
      },
      {
        name: "rerun auto-review",
        method: "POST",
        url: () => `${sub()}/${submissionId}/auto-review`,
        ok: 202,
      },
      {
        name: "list work sessions",
        method: "GET",
        url: () => `/v1/challenges/${challengeId}/work-sessions`,
        ok: 200,
      },
      { name: "list reference solutions", method: "GET", url: ref, ok: 200 },
      {
        name: "update reference solution",
        method: "PUT",
        url: () => `${ref()}/refined`,
        payload: () => ({ code: "print(2)" }),
        ok: 200,
      },
      {
        name: "delete reference solution",
        method: "DELETE",
        url: () => `${ref()}/brute_force`,
        ok: 200,
      },
      {
        name: "create knowledge base",
        method: "POST",
        url: () => "/v1/knowledge-bases",
        payload: () => ({ title: "New", classroomId }),
        ok: 201,
      },
      {
        name: "update knowledge base",
        method: "PUT",
        url: kb,
        payload: () => ({ title: "Renamed" }),
        ok: 200,
      },
      {
        name: "create knowledge-base entry",
        method: "POST",
        url: () => `${kb()}/entries`,
        payload: () => ({ content: "Some note" }),
        ok: 201,
      },
      { name: "delete knowledge base", method: "DELETE", url: kb, ok: 204 },
    ];
  }

  async function send(
    req: ReturnType<typeof staffRequests>[number],
    cookie: string,
  ) {
    return app.inject({
      method: req.method,
      url: req.url(),
      headers: { cookie },
      ...(req.payload ? { payload: req.payload() } : {}),
    });
  }

  beforeEach(async () => {
    orgA = await createOrg();
    orgB = await createOrg();
  });

  it("lets a teacher of org A manage org-A resources while org B is active", async () => {
    const { usr, cookie } = await multiOrgUser("teacher", "student");
    await seedOrgAResources(usr.id);

    for (const req of staffRequests()) {
      const res = await send(req, cookie);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(req.ok);
    }
  });

  it("gives the same answers after switching the active organization", async () => {
    const { usr, cookie } = await multiOrgUser("teacher", "student");
    await seedOrgAResources(usr.id);
    const cookieA = await setActiveOrg({ cookie, organizationId: orgA.id });

    for (const req of staffRequests()) {
      const res = await send(req, cookieA);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(req.ok);
    }
  });

  it("lets an org-A coordinator manage resources while active in an org where they are a student", async () => {
    const lead = await createUser();
    await addMember(lead.id, orgA.id, "teacher");
    await seedOrgAResources(lead.id);
    const { cookie } = await multiOrgUser("coordinator", "student");

    for (const req of staffRequests()) {
      const res = await send(req, cookie);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(req.ok);
    }
  });

  it("denies a student of org A even when they are staff in the active org B", async () => {
    const lead = await createUser();
    await addMember(lead.id, orgA.id, "teacher");
    await seedOrgAResources(lead.id);
    const { usr, cookie } = await multiOrgUser("student", "admin");
    await enrollStudent(usr.id, classroomId);

    for (const req of staffRequests()) {
      const res = await send(req, cookie);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(403);
    }
  });

  it("denies staff of org B who have no membership in org A", async () => {
    const lead = await createUser();
    await addMember(lead.id, orgA.id, "teacher");
    await seedOrgAResources(lead.id);
    const { cookie } = await multiOrgUser(null, "coordinator");

    for (const req of staffRequests()) {
      const res = await send(req, cookie);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(403);
    }
  });

  it("denies a teacher after their org-A membership is revoked", async () => {
    const { usr, cookie } = await multiOrgUser("teacher", "teacher");
    await seedOrgAResources(usr.id);
    await db
      .delete(member)
      .where(
        and(eq(member.userId, usr.id), eq(member.organizationId, orgA.id)),
      );

    for (const req of staffRequests()) {
      const res = await send(req, cookie);
      expect(res.statusCode, `${req.name}: ${res.body}`).toBe(403);
    }
  });

  it("returns 404 for a missing resource regardless of the active-org role", async () => {
    const { cookie } = await multiOrgUser(null, "student");
    const missing = randomUUID();
    const res = await app.inject({
      method: "GET",
      url: `/v1/challenges/${missing}/submissions`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
    const kbRes = await app.inject({
      method: "DELETE",
      url: `/v1/knowledge-bases/${missing}`,
      headers: { cookie },
    });
    expect(kbRes.statusCode).toBe(404);
  });

  describe("organization-scoped routes use the role in the :id organization", () => {
    async function orgRequests(targetOrgId: string) {
      const target = await createUser();
      await addMember(target.id, targetOrgId, "student");
      const invitationId = randomUUID();
      await db.insert(invitation).values({
        id: invitationId,
        organizationId: targetOrgId,
        email: `pending-${invitationId.slice(0, 8)}@test.local`,
        role: "student",
        status: "pending",
        expiresAt: new Date(Date.now() + 86_400_000),
        inviterId: target.id,
      });
      const base = `/v1/organizations/${targetOrgId}`;
      return [
        {
          name: "list members",
          method: "GET" as const,
          url: `${base}/members`,
          ok: 200,
        },
        {
          name: "update member role",
          method: "PUT" as const,
          url: `${base}/members/${target.id}`,
          payload: { role: "teacher" },
          ok: 200,
        },
        {
          name: "create invitation",
          method: "POST" as const,
          url: `${base}/invitations`,
          payload: {
            email: `new-${randomUUID().slice(0, 8)}@test.local`,
            role: "student",
          },
          ok: 201,
        },
        {
          name: "cancel invitation",
          method: "DELETE" as const,
          url: `${base}/invitations/${invitationId}`,
          ok: 200,
        },
        {
          name: "list invitations",
          method: "GET" as const,
          url: `${base}/invitations`,
          ok: 200,
        },
      ];
    }

    it("lets a coordinator of org A manage org A while org B is active", async () => {
      const { cookie } = await multiOrgUser("coordinator", "student");
      for (const req of await orgRequests(orgA.id)) {
        const res = await app.inject({
          method: req.method,
          url: req.url,
          headers: { cookie },
          ...("payload" in req ? { payload: req.payload } : {}),
        });
        expect(res.statusCode, `${req.name}: ${res.body}`).toBe(req.ok);
      }
    });

    it("denies a student of org A who is a coordinator of the active org B", async () => {
      const { cookie } = await multiOrgUser("student", "coordinator");
      for (const req of await orgRequests(orgA.id)) {
        const res = await app.inject({
          method: req.method,
          url: req.url,
          headers: { cookie },
          ...("payload" in req ? { payload: req.payload } : {}),
        });
        expect(res.statusCode, `${req.name}: ${res.body}`).toBe(403);
      }
    });

    it("denies org B staff with no membership in org A", async () => {
      const { cookie } = await multiOrgUser(null, "admin");
      for (const req of await orgRequests(orgA.id)) {
        const res = await app.inject({
          method: req.method,
          url: req.url,
          headers: { cookie },
          ...("payload" in req ? { payload: req.payload } : {}),
        });
        expect(res.statusCode, `${req.name}: ${res.body}`).toBe(403);
      }
    });
  });
});
