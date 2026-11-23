import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@repo/infra/db";
import { env } from "@repo/infra/env";
import {
  challengeKnowledgeBase,
  knowledgeBase,
  knowledgeBaseChunk,
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
  enrollStudent,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

// Only the outbound embedding HTTP call is faked; search, routes and chat run
// for real. The LLM agent and Langfuse are mocked so the chat test is offline.
const EMBEDDING_URL = "https://embedding.test/v1/embeddings";
const DIMS = 1536;
const MATCHING_VECTOR = [1, ...Array<number>(DIMS - 1).fill(0)];
const ORTHOGONAL_VECTOR = [0, 1, ...Array<number>(DIMS - 2).fill(0)];

const mocks = vi.hoisted(() => ({
  embeddingFetch: vi.fn<() => Promise<Response>>(),
  invoke: vi.fn(),
  langfuse: vi.fn(),
}));
vi.mock("../../../../../agents/llm-factory", () => ({
  createLlm: () => ({}),
  AGENT_TIMEOUT_MS: 1000,
  AgentTimeoutError: class extends Error {},
}));
vi.mock("../../../../../agents/langfuse", () => ({
  getLangfuseCallback: mocks.langfuse,
}));
vi.mock("../../../../../agents/teaching-assistant/agent", () => ({
  buildTeachingAssistantAgent: () => ({ invoke: mocks.invoke }),
}));

function embeddingOk(vector: number[]) {
  return new Response(
    JSON.stringify({ data: [{ index: 0, embedding: vector }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

const UNAVAILABLE_CASES = [
  ["HTTP 503", () => Promise.resolve(new Response("down", { status: 503 }))],
  ["network error", () => Promise.reject(new TypeError("fetch failed"))],
  [
    "HTTP 200 without a data array",
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ object: "list" }), { status: 200 })
      ),
  ],
] as const;

describe("knowledge-base retrieval when the embedding service fails", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let kbId: string;
  let challengeId: string;
  let workSessionId: string;
  let learnerCookie: string;
  let teacherCookie: string;
  const originalEnv = {
    url: env.EMBEDDING_API_URL,
    key: env.EMBEDDING_API_KEY,
    provider: env.EMBEDDING_PROVIDER,
  };

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    env.EMBEDDING_API_URL = EMBEDDING_URL;
    env.EMBEDDING_API_KEY = "test-key";
    env.EMBEDDING_PROVIDER = "openai";
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) =>
      String(args[0]) === EMBEDDING_URL
        ? mocks.embeddingFetch()
        : realFetch(...args)
    );
    mocks.langfuse.mockReturnValue({ flushAsync: async () => {} });
    mocks.invoke.mockResolvedValue({
      messages: [{ content: "Tutor reply" }],
    });

    const org = await createOrg();
    const teacher = await createUser();
    const learner = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    await addMember(learner.id, org.id, "student");
    const cls = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    await enrollStudent(learner.id, cls.id);
    const ch = await createChallenge({
      classroomId: cls.id,
      createdByUserId: teacher.id,
    });
    challengeId = ch.id;
    kbId = randomUUID();
    await db.insert(knowledgeBase).values({
      id: kbId,
      title: "Loops",
      classroomId: cls.id,
      organizationId: org.id,
      createdByUserId: teacher.id,
    });
    await db
      .insert(challengeKnowledgeBase)
      .values({ challengeId, knowledgeBaseId: kbId });
    await db.insert(knowledgeBaseChunk).values({
      id: randomUUID(),
      knowledgeBaseId: kbId,
      content: "A for loop iterates over a sequence.",
      embedding: MATCHING_VECTOR,
    });
    const ta = await createTeachingAssistant({ organizationId: org.id });
    const ws = await createWorkSession({
      userId: learner.id,
      challengeId,
      classroomId: cls.id,
      teachingAssistantId: ta.id,
    });
    workSessionId = ws.id;
    learnerCookie = await loginAs({
      email: learner.email,
      password: TEST_PASSWORD,
    });
    teacherCookie = await loginAs({
      email: teacher.email,
      password: TEST_PASSWORD,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    env.EMBEDDING_API_URL = originalEnv.url;
    env.EMBEDDING_API_KEY = originalEnv.key;
    env.EMBEDDING_PROVIDER = originalEnv.provider;
  });

  const searchUrls = () => [
    `/v1/knowledge-bases/${kbId}/search?q=loops`,
    `/v1/challenges/${challengeId}/knowledge-bases/search?q=loops`,
  ];

  describe.each(UNAVAILABLE_CASES)("embedding %s", (_label, failure) => {
    it("search endpoints return 503 with a clear message", async () => {
      mocks.embeddingFetch.mockImplementation(failure);
      for (const url of searchUrls()) {
        const res = await app.inject({
          url,
          headers: { cookie: teacherCookie },
        });
        expect(res.statusCode, url).toBe(503);
        expect(res.json()).toMatchObject({
          success: false,
          message: expect.stringMatching(/temporarily unavailable/i),
        });
      }
      expect(mocks.embeddingFetch).toHaveBeenCalledTimes(2);
    });

    it("chat still answers and records the retrieval failure in Langfuse metadata", async () => {
      mocks.embeddingFetch.mockImplementation(failure);
      const res = await app.inject({
        method: "POST",
        url: `/v1/work-sessions/${workSessionId}/chat`,
        headers: { cookie: learnerCookie },
        payload: { message: "How do loops work?" },
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.langfuse).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(["rag:unavailable"]),
          metadata: expect.objectContaining({
            kbRetrieval: expect.objectContaining({
              status: "unavailable",
              failureReason: expect.stringMatching(/^embedding_/),
            }),
          }),
        })
      );
    });
  });

  describe("embedding service not configured", () => {
    beforeEach(() => {
      env.EMBEDDING_API_URL = undefined;
    });

    it("search endpoints return 503 saying search is not available in this deployment", async () => {
      for (const url of searchUrls()) {
        const res = await app.inject({
          url,
          headers: { cookie: teacherCookie },
        });
        expect(res.statusCode, url).toBe(503);
        const body = res.json<{ success: boolean; message: string }>();
        expect(body.success).toBe(false);
        expect(body.message).toMatch(/not available in this deployment/i);
        expect(body.message).not.toMatch(/temporarily/i);
      }
      expect(mocks.embeddingFetch).not.toHaveBeenCalled();
    });

    it("chat tags the turn rag:not_configured instead of rag:unavailable", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/v1/work-sessions/${workSessionId}/chat`,
        headers: { cookie: learnerCookie },
        payload: { message: "How do loops work?" },
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.langfuse).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ["agent:ta", "rag:not_configured"],
          metadata: expect.objectContaining({
            kbRetrieval: expect.objectContaining({
              status: "unavailable",
              failureReason: "embedding_not_configured",
            }),
          }),
        })
      );
    });
  });

  it("search endpoints return 200 with an empty list when nothing matches", async () => {
    mocks.embeddingFetch.mockImplementation(() =>
      Promise.resolve(embeddingOk(ORTHOGONAL_VECTOR))
    );
    for (const url of searchUrls()) {
      const res = await app.inject({ url, headers: { cookie: teacherCookie } });
      expect(res.statusCode, url).toBe(200);
      expect(res.json()).toMatchObject({ success: true, data: [] });
    }
  });

  it("search endpoints return matches when the service is healthy", async () => {
    mocks.embeddingFetch.mockImplementation(() =>
      Promise.resolve(embeddingOk(MATCHING_VECTOR))
    );
    for (const url of searchUrls()) {
      const res = await app.inject({ url, headers: { cookie: teacherCookie } });
      expect(res.statusCode, url).toBe(200);
      expect(
        res.json<{ data: { content: string }[] }>().data.map((r) => r.content)
      ).toEqual(["A for loop iterates over a sequence."]);
    }
  });

  it("chat reports a successful retrieval with no results as ok, not unavailable", async () => {
    mocks.embeddingFetch.mockImplementation(() =>
      Promise.resolve(embeddingOk(ORTHOGONAL_VECTOR))
    );
    const res = await app.inject({
      method: "POST",
      url: `/v1/work-sessions/${workSessionId}/chat`,
      headers: { cookie: learnerCookie },
      payload: { message: "How do loops work?" },
    });
    expect(res.statusCode).toBe(200);
    expect(mocks.langfuse).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ["agent:ta"],
        metadata: expect.objectContaining({
          kbRetrieval: { status: "ok", resultCount: 0 },
        }),
      })
    );
  });
});
