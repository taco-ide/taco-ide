import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@repo/infra/db";
import { eq } from "drizzle-orm";
import {
  challengeKnowledgeBase,
  challengeReferenceSolution,
  knowledgeBase,
  submission,
} from "@repo/infra/db/schema";
import { getApp } from "../../../test/helpers/app";
import { loginAs } from "../../../test/helpers/auth";
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
  TEST_PASSWORD,
} from "../../../test/helpers/factories";
import { rateLimitSettings } from "../rate-limit";

const mocks = vi.hoisted(() => ({
  agent: vi.fn(),
  generate: vi.fn(async () => {}),
  startRefs: vi.fn(async (_id: string, kinds: string[]) => ({ claimed: kinds })),
  runAutoReview: vi.fn(async () => {}),
  startAutoReview: vi.fn(async () => ({ started: true })),
  searchKb: vi.fn(async () => []),
  searchChallengeKbs: vi.fn(async () => []),
}));
vi.mock("../../../services/knowledge-base-search", () => ({
  searchKnowledgeBase: mocks.searchKb,
  searchChallengeKnowledgeBases: mocks.searchChallengeKbs,
}));
vi.mock("../../../agents/llm-factory", () => ({
  createLlm: () => ({}),
  AGENT_TIMEOUT_MS: 1000,
  AgentTimeoutError: class extends Error {},
}));
vi.mock("../../../agents/teaching-assistant/agent", () => ({
  buildTeachingAssistantAgent: () => ({ streamEvents: mocks.agent }),
}));
vi.mock("../../../agents/teachers-companion/reference-solution", () => ({
  generateReferenceSolutions: mocks.generate,
  startReferenceSolutions: mocks.startRefs,
}));
vi.mock("../../../agents/teachers-companion/auto-review", () => ({
  runAutoReview: mocks.runAutoReview,
  startAutoReview: mocks.startAutoReview,
}));

const defaults = structuredClone(rateLimitSettings);

describe("API rate limits", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let classroomId: string;
  let challengeId: string;
  let taId: string;
  let kbId: string;
  let cookies: { teacher: string; student: string };

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const org = await createOrg();
    teacher = await createUser();
    student = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    await addMember(student.id, org.id, "student");
    const cl = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    classroomId = cl.id;
    await enrollStudent(student.id, classroomId);
    challengeId = (
      await createChallenge({ classroomId, createdByUserId: teacher.id })
    ).id;
    taId = (await createTeachingAssistant({ organizationId: org.id })).id;
    kbId = randomUUID();
    await db.insert(knowledgeBase).values({
      id: kbId,
      organizationId: org.id,
      classroomId,
      title: "KB",
      createdByUserId: teacher.id,
    });
    await db
      .insert(challengeKnowledgeBase)
      .values({ challengeId, knowledgeBaseId: kbId });
    cookies = {
      teacher: await loginAs({ email: teacher.email, password: TEST_PASSWORD }),
      student: await loginAs({ email: student.email, password: TEST_PASSWORD }),
    };
  });

  afterEach(() => {
    Object.assign(rateLimitSettings, structuredClone(defaults));
  });

  // Ended sessions make the chat handlers answer 400 without calling the
  // agent, so each request counts against the limiter at no LLM cost.
  async function endedSession(forChallengeId = challengeId) {
    return createWorkSession({
      userId: student.id,
      challengeId: forChallengeId,
      classroomId,
      teachingAssistantId: taId,
      endedAt: new Date(),
    });
  }

  it("shares one per-user chat budget across chat routes and sessions", async () => {
    rateLimitSettings.aiChat = { perMinute: 3, perDay: 100 };
    const other = await createChallenge({
      classroomId,
      createdByUserId: teacher.id,
    });
    const [a, b] = [await endedSession(), await endedSession(other.id)];
    const headers = { cookie: cookies.student };

    const statuses = [
      await app.inject({
        method: "POST",
        url: `/v1/work-sessions/${a.id}/chat`,
        headers,
        payload: { message: "hi" },
      }),
      await app.inject({
        method: "POST",
        url: "/v1/chat/student/message",
        headers,
        payload: { workSessionId: b.id, message: "hi" },
      }),
      await app.inject({
        method: "POST",
        url: `/v1/work-sessions/${b.id}/chat`,
        headers,
        payload: { message: "hi" },
      }),
    ].map((r) => r.statusCode);
    expect(statuses).toEqual([400, 400, 400]);

    const limited = await app.inject({
      method: "POST",
      url: "/v1/chat/student/message",
      headers,
      payload: { workSessionId: a.id, message: "hi" },
    });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(limited.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(limited.headers["x-ratelimit-limit"]).toBe("3");
    expect(limited.json()).toMatchObject({
      success: false,
      code: "RATE_LIMITED",
      message: expect.stringMatching(/chat/i),
      retryAfterSeconds: expect.any(Number),
    });
    expect(mocks.agent).not.toHaveBeenCalled();

    // Another user keeps their own budget.
    const ws = await createWorkSession({
      userId: teacher.id,
      challengeId,
      classroomId,
      teachingAssistantId: taId,
      endedAt: new Date(),
    });
    const otherUser = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${ws.id}/chat`,
      headers: { cookie: cookies.teacher },
      payload: { message: "hi" },
    });
    expect(otherUser.statusCode).toBe(400);
  });

  it("enforces the daily chat cap with a day-long Retry-After", async () => {
    rateLimitSettings.aiChat = { perMinute: 100, perDay: 2 };
    const ws = await endedSession();
    const send = () =>
      app.inject({
        method: "POST",
        url: `/v1/work-sessions/${ws.id}/chat`,
        headers: { cookie: cookies.student },
        payload: { message: "hi" },
      });

    expect((await send()).statusCode).toBe(400);
    expect((await send()).statusCode).toBe(400);
    const limited = await send();
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(3600);
  });

  it("does not spend chat budget on requests that fail validation", async () => {
    rateLimitSettings.aiChat = { perMinute: 1, perDay: 100 };
    const ws = await endedSession();
    const url = `/v1/work-sessions/${ws.id}/chat`;
    const headers = { cookie: cookies.student };

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url,
        headers,
        payload: { message: "" },
      });
      expect(res.statusCode).toBe(400);
    }
    expect(
      (await app.inject({ method: "POST", url, headers, payload: { message: "hi" } }))
        .statusCode
    ).toBe(400);
    expect(
      (await app.inject({ method: "POST", url, headers, payload: { message: "hi" } }))
        .statusCode
    ).toBe(429);
  });

  it("saves challenges but skips reference solutions once the AI budget is spent", async () => {
    rateLimitSettings.aiGeneration = { perMinute: 1, perDay: 100 };
    const headers = { cookie: cookies.teacher };
    const create = (generateReferenceSolutions?: boolean) =>
      app.inject({
        method: "POST",
        url: "/v1/challenges",
        headers,
        payload: {
          title: "Rate limited",
          difficulty: "easy",
          classroomId,
          ...(generateReferenceSolutions === undefined
            ? {}
            : { generateReferenceSolutions }),
        },
      });

    // Opting out spends no budget.
    expect((await create(false)).statusCode).toBe(201);
    expect((await create(false)).statusCode).toBe(201);
    const first = await create();
    expect(first.statusCode).toBe(201);
    expect(first.json().data.referenceSolutionsSkipped).toBeUndefined();

    const skipped = await create();
    expect(skipped.statusCode).toBe(201);
    expect(skipped.json().data).toMatchObject({
      title: "Rate limited",
      referenceSolutionsSkipped: {
        code: "RATE_LIMITED",
        message: expect.any(String),
        retryAfterSeconds: expect.any(Number),
      },
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);

    // Edits save too; only the generation is skipped.
    const edited = await app.inject({
      method: "PATCH",
      url: `/v1/challenges/${challengeId}`,
      headers,
      payload: { title: "Edited", generateReferenceSolutions: true },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().data).toMatchObject({
      title: "Edited",
      referenceSolutionsSkipped: { code: "RATE_LIMITED" },
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("does not spend AI budget on regenerations refused as already running", async () => {
    rateLimitSettings.aiGeneration = { perMinute: 1, perDay: 100 };
    await db.insert(challengeReferenceSolution).values({
      id: randomUUID(),
      challengeId,
      kind: "refined",
      status: "running",
    });
    const regenerate = () =>
      app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeId}/reference-solutions/refined/regenerate`,
        headers: { cookie: cookies.teacher },
      });

    expect((await regenerate()).statusCode).toBe(409);
    expect((await regenerate()).statusCode).toBe(409);

    await db
      .update(challengeReferenceSolution)
      .set({ status: "failed" })
      .where(eq(challengeReferenceSolution.challengeId, challengeId));
    expect((await regenerate()).statusCode).toBe(202);
    const limited = await regenerate();
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(mocks.startRefs).toHaveBeenCalledTimes(1);
  });

  it("does not spend AI budget on auto-review re-runs refused by the cooldown", async () => {
    rateLimitSettings.aiGeneration = { perMinute: 1, perDay: 100 };
    const ws = await endedSession();
    const sub = await createSubmission({
      workSessionId: ws.id,
      challengeId,
      studentUserId: student.id,
    });
    await db
      .update(submission)
      .set({ autoReviewStatus: "complete", autoReviewAt: new Date() })
      .where(eq(submission.id, sub.id));
    const rerun = () =>
      app.inject({
        method: "POST",
        url: `/v1/challenges/${challengeId}/submissions/${sub.id}/auto-review`,
        headers: { cookie: cookies.teacher },
      });

    for (let i = 0; i < 2; i++) {
      const cooldown = await rerun();
      expect(cooldown.statusCode).toBe(429);
      expect(cooldown.json().code).toBeUndefined();
    }

    await db
      .update(submission)
      .set({ autoReviewAt: new Date(Date.now() - 120_000) })
      .where(eq(submission.id, sub.id));
    expect((await rerun()).statusCode).toBe(202);
    expect((await rerun()).json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(mocks.startAutoReview).toHaveBeenCalledTimes(1);
  });

  it("limits submission auto-reviews per student without blocking the submit", async () => {
    rateLimitSettings.aiGeneration = { perMinute: 1, perDay: 100 };
    const submit = async () => {
      // One work session per student and challenge.
      const ch = await createChallenge({ classroomId, createdByUserId: teacher.id });
      const ws = await createWorkSession({
        userId: student.id,
        challengeId: ch.id,
        classroomId,
        teachingAssistantId: taId,
      });
      const res = await app.inject({
        method: "POST",
        url: `/v1/work-sessions/${ws.id}/submit`,
        headers: { cookie: cookies.student },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const [row] = await db
        .select()
        .from(submission)
        .where(eq(submission.id, res.json().data.submissionId));
      return row!;
    };

    expect((await submit()).autoReviewStatus).toBe("pending");
    const skipped = await submit();
    expect(skipped.autoReviewStatus).toBe("failed");
    expect(skipped.autoReviewError).toMatch(/skipped/i);
    expect(mocks.runAutoReview).toHaveBeenCalledTimes(1);
  });

  it("limits knowledge base search per user across search routes", async () => {
    rateLimitSettings.embedding = { perMinute: 2, perDay: 100 };
    const headers = { cookie: cookies.teacher };

    expect(
      (await app.inject({ url: `/v1/knowledge-bases/${kbId}/search?q=loops`, headers }))
        .statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: `/v1/challenges/${challengeId}/knowledge-bases/search?q=loops`,
          headers,
        })
      ).statusCode
    ).toBe(200);
    const limited = await app.inject({
      url: `/v1/knowledge-bases/${kbId}/search?q=loops`,
      headers,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(mocks.searchKb).toHaveBeenCalledTimes(1);
    expect(mocks.searchChallengeKbs).toHaveBeenCalledTimes(1);
  });

  it("rejects overly long search queries", async () => {
    const res = await app.inject({
      url: `/v1/knowledge-bases/${kbId}/search?q=${"a".repeat(1001)}`,
      headers: { cookie: cookies.teacher },
    });
    expect(res.statusCode).toBe(400);
    expect(mocks.searchKb).not.toHaveBeenCalled();
  });

  it("applies the global per-user default to every other route", async () => {
    rateLimitSettings.globalPerMinute = 2;
    const me = (cookie: string) =>
      app.inject({ url: "/v1/users/me", headers: { cookie } });

    expect((await me(cookies.student)).statusCode).toBe(200);
    expect((await me(cookies.student)).statusCode).toBe(200);
    const limited = await me(cookies.student);
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited.json()).toEqual({
      success: false,
      message: expect.any(String),
      code: "RATE_LIMITED",
      retryAfterSeconds: expect.any(Number),
    });
    expect((await me(cookies.teacher)).statusCode).toBe(200);
  });

  it("leaves Better Auth routes to Better Auth's own limiter", async () => {
    rateLimitSettings.globalPerMinute = 1;
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        url: "/v1/auth/get-session",
        headers: { cookie: cookies.student },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
