import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeSolution,
  taTurnContext,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import { getApp } from "../../../../../test/helpers/app";
import { loginAs } from "../../../../../test/helpers/auth";
import {
  addInteraction,
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
import {
  ScriptedChatModel,
  type ScriptedTurn,
} from "../../../../../test/helpers/scripted-chat-model";
import type { KBSearchResult } from "../../../../../services/knowledge-base-search";
import { challengeContentHash } from "../../../../../agents/teaching-assistant/turn-context";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  createLlm: vi.fn(),
  langfuse: vi.fn(),
}));
vi.mock("../../../../../services/knowledge-base-search", () => ({
  searchChallengeKnowledgeBases: mocks.search,
}));
vi.mock("../../../../../agents/llm-factory", () => ({
  createLlm: mocks.createLlm,
  AGENT_TIMEOUT_MS: 10_000,
  AgentTimeoutError: class extends Error {},
}));
vi.mock("../../../../../agents/langfuse", () => ({
  getLangfuseCallback: mocks.langfuse,
}));

class FakeLangfuse extends BaseCallbackHandler {
  name = "fake-langfuse";
  async flushAsync() {}
  getTraceId() {
    return "trace-123";
  }
}

function kbChunk(id: string, content: string, similarity: number): KBSearchResult {
  return {
    id,
    content,
    similarity,
    metadata: { documentFilename: "loops.md", titleHierarchy: ["Loops"] },
    chunkIndex: 2,
    documentId: null,
    knowledgeBaseId: "kb-1",
    createdAt: new Date(),
  };
}

const PREFETCH_CHUNK = kbChunk("chunk-prefetch", "A for loop repeats a block.", 0.82);
const TOOL_CHUNK = kbChunk("chunk-tool", "range(n) yields 0 to n-1.", 0.77);
const ANSWER = "What does range(3) produce?";

const searchThenAnswer: ScriptedTurn[] = [
  {
    content: "",
    toolCalls: [{ id: "call_1", name: "searchKnowledgeBase", args: { query: "range function" } }],
    usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 },
  },
  {
    content: ANSWER,
    responseMetadata: {
      model_name: "gpt-test-2026-01-01",
      system_fingerprint: "fp_test",
      finish_reason: "stop",
    },
    usage: { input_tokens: 150, output_tokens: 20, total_tokens: 170 },
  },
];

type Route = "json" | "sse";

describe("teaching assistant turn capture", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let challengeId: string;
  let classroomId: string;
  let taId: string;
  let students: { id: string; cookie: string }[];

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.langfuse.mockImplementation(() => new FakeLangfuse());
    mocks.search.mockResolvedValue([]);

    const org = await createOrg();
    const teacher = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    const classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    classroomId = classroom.id;
    const ch = await createChallenge({
      classroomId,
      createdByUserId: teacher.id,
      title: "Count to n",
      description: "Print the numbers from 0 to n-1.",
    });
    challengeId = ch.id;
    await db
      .update(challenge)
      .set({ supportMaterials: [{ url: "https://docs.python.org", label: "docs" }] })
      .where(eq(challenge.id, challengeId));
    taId = (await createTeachingAssistant({ organizationId: org.id })).id;

    students = [];
    for (let i = 0; i < 2; i++) {
      const student = await createUser();
      await addMember(student.id, org.id, "student");
      await enrollStudent(student.id, classroomId);
      students.push({
        id: student.id,
        cookie: await loginAs({ email: student.email, password: TEST_PASSWORD }),
      });
    }
  });

  async function startSession(studentIndex = 0) {
    return createWorkSession({
      userId: students[studentIndex]!.id,
      challengeId,
      classroomId,
      teachingAssistantId: taId,
    });
  }

  async function sendTurn(
    route: Route,
    wsId: string,
    body: { message: string; code?: string; stdin?: string; stdout?: string },
    studentIndex = 0
  ) {
    const headers = { cookie: students[studentIndex]!.cookie };
    if (route === "json") {
      return app.inject({
        method: "POST",
        url: `/v1/work-sessions/${wsId}/chat`,
        headers,
        payload: body,
      });
    }
    return app.inject({
      method: "POST",
      url: "/v1/chat/student/message",
      headers,
      payload: {
        workSessionId: wsId,
        message: body.message,
        currentCode: body.code,
        stdout: body.stdout,
      },
    });
  }

  async function latestTurn(wsId: string) {
    const rows = await db
      .select()
      .from(userInteractionOnChallenge)
      .leftJoin(taTurnContext, eq(taTurnContext.interactionId, userInteractionOnChallenge.id))
      .where(
        and(
          eq(userInteractionOnChallenge.workSessionId, wsId),
          eq(userInteractionOnChallenge.userPrompt, "How do I loop n times?")
        )
      );
    expect(rows).toHaveLength(1);
    return rows[0]!;
  }

  it.each<Route>(["json", "sse"])(
    "records everything the AE received and did on a %s turn",
    async (route) => {
      const ws = await startSession();
      const previous = await addInteraction({
        workSessionId: ws.id,
        challengeId,
        userPrompt: "Where do I start?",
        modelResponse: "What should the output look like?",
      });
      mocks.search
        .mockResolvedValueOnce([PREFETCH_CHUNK])
        .mockResolvedValueOnce([TOOL_CHUNK]);
      mocks.createLlm.mockImplementation(() => new ScriptedChatModel(searchThenAnswer));

      const response = await sendTurn(route, ws.id, {
        message: "How do I loop n times?",
        code: "n = int(input())\nfor i in ???:",
        stdin: "3",
        stdout: "SyntaxError: invalid syntax",
      });

      expect(response.statusCode).toBe(200);
      if (route === "json") {
        expect(response.json().data.modelResponse).toBe(ANSWER);
      } else {
        expect(response.body).toContain(ANSWER);
        expect(response.body).toContain('"type":"done"');
      }

      const { user_interaction_on_challenge: row, ta_turn_context: context } =
        await latestTurn(ws.id);
      expect(row.modelResponse).toBe(ANSWER);
      expect(row.code).toBe("n = int(input())\nfor i in ???:");
      expect(row.stdout).toBe("SyntaxError: invalid syntax");
      // The SSE body has no stdin field.
      expect(row.stdin).toBe(route === "json" ? "3" : null);

      expect(context).not.toBeNull();
      expect(context!.schemaVersion).toBe(1);
      expect(context!.teachingAssistantId).toBe(taId);
      expect(context!.historyInteractionIds).toEqual([previous.id]);
      expect(context!.langfuseTraceId).toBe("trace-123");

      expect(context!.promptContext).toMatchObject({
        systemPrompt: "You are a test TA",
        challengeTitle: "Count to n",
        challengeDescription: "Print the numbers from 0 to n-1.",
        supportMaterials: "- Link: https://docs.python.org (docs)",
        currentCode: "n = int(input())\nfor i in ???:",
        stdout: "SyntaxError: invalid syntax",
      });
      expect(context!.promptContext.kbContext).toContain("A for loop repeats a block.");
      expect(context!.systemPrompt).toContain("n = int(input())\nfor i in ???:");
      expect(context!.systemPrompt).toContain("A for loop repeats a block.");
      expect(context!.challenge).toEqual({
        id: challengeId,
        contentHash: challengeContentHash(context!.promptContext),
      });

      expect(context!.retrieval.prefetch).toMatchObject({
        query: "How do I loop n times?",
        limit: 5,
        threshold: 0.3,
        chunks: [{ id: "chunk-prefetch", content: "A for loop repeats a block." }],
      });
      expect(context!.retrieval.toolCalls).toEqual([
        expect.objectContaining({
          query: "range function",
          chunks: [expect.objectContaining({ id: "chunk-tool", similarity: 0.77 })],
        }),
      ]);

      expect(context!.llm.requested).toMatchObject({
        model: "gpt-test",
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 512,
        baseUrlHost: "llm.example.test",
      });
      expect(context!.llm.resolved).toEqual({
        modelName: "gpt-test-2026-01-01",
        systemFingerprint: "fp_test",
        finishReason: "stop",
      });
      expect(context!.llm.usage).toEqual({
        inputTokens: 250,
        outputTokens: 30,
        totalTokens: 280,
      });

      expect(context!.trajectory.map((m) => m.type)).toEqual(["ai", "tool", "ai"]);
      expect(JSON.stringify(context!.trajectory[1])).toContain("range(n) yields 0 to n-1.");
    }
  );

  it("uses the saved solution when the client sends no code or output", async () => {
    const ws = await startSession();
    await db.insert(challengeSolution).values({
      id: crypto.randomUUID(),
      userId: students[0]!.id,
      challengeId,
      code: "print('saved')",
      stdin: "7",
      stdout: "saved",
    });
    mocks.createLlm.mockImplementation(() => new ScriptedChatModel([{ content: ANSWER }]));

    const response = await sendTurn("json", ws.id, { message: "How do I loop n times?" });

    expect(response.statusCode).toBe(200);
    const { user_interaction_on_challenge: row, ta_turn_context: context } =
      await latestTurn(ws.id);
    expect(row).toMatchObject({ code: "print('saved')", stdin: "7", stdout: "saved" });
    expect(context!.promptContext).toMatchObject({ currentCode: "print('saved')", stdout: "saved" });
  });

  it.each<Route>(["json", "sse"])("writes nothing on a %s fallback turn", async (route) => {
    const ws = await startSession();
    mocks.createLlm.mockImplementation(() => new ScriptedChatModel([{ content: "" }]));

    const response = await sendTurn(route, ws.id, { message: "How do I loop n times?" });

    expect(response.statusCode).toBe(200);
    expect(
      await db
        .select()
        .from(userInteractionOnChallenge)
        .where(eq(userInteractionOnChallenge.workSessionId, ws.id))
    ).toHaveLength(0);
    expect(await db.select().from(taTurnContext)).toHaveLength(0);
  });

  it("gives the AE the same inputs on both routes for the same body", async () => {
    const jsonSession = await startSession(0);
    const sseSession = await startSession(1);
    mocks.search.mockResolvedValue([PREFETCH_CHUNK]);
    mocks.createLlm.mockImplementation(() => new ScriptedChatModel([{ content: ANSWER }]));
    const body = {
      message: "How do I loop n times?",
      code: "for i in range(n): pass",
      stdout: "",
    };

    expect((await sendTurn("json", jsonSession.id, body, 0)).statusCode).toBe(200);
    expect((await sendTurn("sse", sseSession.id, body, 1)).statusCode).toBe(200);

    const json = (await latestTurn(jsonSession.id)).ta_turn_context!;
    const sse = (await latestTurn(sseSession.id)).ta_turn_context!;
    expect(sse.promptContext).toEqual(json.promptContext);
    expect(sse.systemPrompt).toBe(json.systemPrompt);
    expect(sse.retrieval.prefetch).toEqual(json.retrieval.prefetch);
  });
});
