import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  taTurnContext,
  taTurnContextValuesSchema,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import {
  buildTurnContext,
  challengeContentHash,
  createTurnCollector,
  describeRequestedLlm,
  finalAnswerText,
  persistTurn,
  toRetrieval,
  TurnCaptureHandler,
  withoutNul,
  type TurnContextInput,
} from "../turn-context";
import type { TeachingAssistantPromptContext } from "../prompt";
import {
  addMember,
  createChallenge,
  createClassroom,
  createOrg,
  createTeachingAssistant,
  createUser,
  createWorkSession,
} from "../../../test/helpers/factories";

const promptContext: TeachingAssistantPromptContext = {
  systemPrompt: "Be Socratic",
  targetAudience: "beginner",
  challengeTitle: "Sum a list",
  challengeDescription: "Return the sum of a list",
  supportMaterials: "- Link: https://docs.python.org",
  currentCode: "def total(xs): pass",
  stdout: "None",
  detectedLanguage: "Portuguese",
};

const kbResult = {
  id: "chunk-1",
  content: "Use a for loop to accumulate.",
  similarity: 0.81,
  metadata: { documentFilename: "loops.md" },
  chunkIndex: 3,
  documentId: "doc-1",
  knowledgeBaseId: "kb-1",
  createdAt: new Date(),
};

function input(overrides: Partial<TurnContextInput> = {}): TurnContextInput {
  const collector = createTurnCollector();
  collector.toolRetrievals.push(
    toRetrieval({ query: "for loop", limit: 5, threshold: 0.3, results: [kbResult] })
  );
  return {
    interactionId: "interaction-1",
    appVersion: "abc123",
    teachingAssistantId: "ta-1",
    challengeId: "challenge-1",
    systemPrompt: "rendered prompt",
    promptContext,
    historyInteractionIds: ["h1", "h2"],
    prefetch: toRetrieval({ query: "help", limit: 5, threshold: 0.3, results: [kbResult] }),
    collector,
    llm: {
      model: "gpt-x",
      temperature: 0.1,
      apiKey: "sk-secret",
      clientConfig: { baseURL: "https://llm.example.test/v1/", apiKey: "sk-secret" },
    },
    producedMessages: [
      new AIMessage({
        content: "",
        tool_calls: [{ id: "c1", name: "searchKnowledgeBase", args: { query: "for loop" } }],
        usage_metadata: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      }),
      new ToolMessage({ content: '{"results":[]}', tool_call_id: "c1" }),
      new AIMessage({
        content: "What would a loop need?",
        response_metadata: {
          model_name: "gpt-x-2026-01-01",
          system_fingerprint: "fp_1",
          finish_reason: "stop",
        },
        usage_metadata: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
      }),
    ],
    langfuseTraceId: "trace-1",
    ...overrides,
  };
}

describe("buildTurnContext", () => {
  it("assembles a row the stored schema accepts", () => {
    const row = buildTurnContext(input());

    expect(taTurnContextValuesSchema.parse(row)).toBeTruthy();
    expect(row).toMatchObject({
      interactionId: "interaction-1",
      schemaVersion: 1,
      appVersion: "abc123",
      teachingAssistantId: "ta-1",
      systemPrompt: "rendered prompt",
      promptContext,
      historyInteractionIds: ["h1", "h2"],
      langfuseTraceId: "trace-1",
    });
    expect(row.challenge).toEqual({
      id: "challenge-1",
      contentHash: challengeContentHash(promptContext),
    });
  });

  it("keeps the retrieved chunks with ids and text", () => {
    const { retrieval } = buildTurnContext(input());

    expect(retrieval.prefetch?.chunks).toEqual([
      {
        id: "chunk-1",
        knowledgeBaseId: "kb-1",
        documentId: "doc-1",
        chunkIndex: 3,
        similarity: 0.81,
        content: "Use a for loop to accumulate.",
        metadata: { documentFilename: "loops.md" },
      },
    ]);
    expect(retrieval.toolCalls).toHaveLength(1);
    expect(retrieval.toolCalls[0]).toMatchObject({ query: "for loop", limit: 5, threshold: 0.3 });
  });

  it("reports the requested and resolved model and sums usage across calls", () => {
    const { llm } = buildTurnContext(input());

    expect(llm.requested).toEqual({
      model: "gpt-x",
      temperature: 0.1,
      topP: null,
      maxTokens: null,
      frequencyPenalty: null,
      presencePenalty: null,
      baseUrlHost: "llm.example.test",
    });
    expect(llm.resolved).toEqual({
      modelName: "gpt-x-2026-01-01",
      systemFingerprint: "fp_1",
      finishReason: "stop",
    });
    expect(llm.usage).toEqual({ inputTokens: 30, outputTokens: 7, totalTokens: 37 });
    expect(JSON.stringify(llm)).not.toContain("sk-secret");
  });

  it("stores the turn's messages as a rehydratable trajectory", () => {
    const { trajectory } = buildTurnContext(input());

    expect(trajectory.map((m) => m.type)).toEqual(["ai", "tool", "ai"]);
    expect(trajectory[2]?.data).toMatchObject({ content: "What would a loop need?" });
  });

  it("takes the resolved model from the generation info when streaming left response_metadata empty", () => {
    const collector = createTurnCollector();
    new TurnCaptureHandler(collector).handleLLMEnd({
      generations: [[{ text: "", generationInfo: { finish_reason: "tool_calls" } }]],
    });
    new TurnCaptureHandler(collector).handleLLMEnd({
      generations: [
        [
          {
            text: "Hi",
            generationInfo: {
              model_name: "gpt-x-stream",
              system_fingerprint: "fp_s",
              finish_reason: "stop",
            },
          },
        ],
      ],
    });

    const { llm } = buildTurnContext(
      input({
        collector,
        producedMessages: [
          new AIMessage({ content: "Hi", response_metadata: { model_provider: "openai" } }),
        ],
      })
    );

    expect(collector.generationInfos).toHaveLength(2);
    expect(llm.resolved).toEqual({
      modelName: "gpt-x-stream",
      systemFingerprint: "fp_s",
      finishReason: "stop",
    });
  });

  it("has no usage and null resolution when the turn produced no AI message", () => {
    const { llm } = buildTurnContext(input({ producedMessages: [] }));

    expect(llm.usage).toBeNull();
    expect(llm.resolved).toEqual({ modelName: null, systemFingerprint: null, finishReason: null });
  });
});

describe("finalAnswerText", () => {
  it("returns the trimmed text of the last produced message", () => {
    expect(
      finalAnswerText([new AIMessage("Let me look. "), new AIMessage("  Try range(n).\n")])
    ).toBe("Try range(n).");
    expect(finalAnswerText([])).toBe("");
    expect(finalAnswerText([new AIMessage("   ")])).toBe("");
  });
});

describe("withoutNul", () => {
  it("replaces NUL in every string, including object keys, and keeps dates", () => {
    const at = new Date();
    expect(
      withoutNul({ a: "x\u0000y", list: ["\u0000", 1, null], ["k\u0000"]: { at } })
    ).toEqual({ a: "x�y", list: ["�", 1, null], ["k�"]: { at } });
  });
});

describe("challengeContentHash", () => {
  it("changes when the challenge text the AE saw changes", () => {
    const hash = challengeContentHash(promptContext);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(challengeContentHash({ ...promptContext })).toBe(hash);
    expect(
      challengeContentHash({ ...promptContext, challengeDescription: "Return the product" })
    ).not.toBe(hash);
  });
});

describe("describeRequestedLlm", () => {
  it("returns nulls for a model without the known fields", () => {
    expect(describeRequestedLlm({})).toEqual({
      model: null,
      temperature: null,
      topP: null,
      maxTokens: null,
      frequencyPenalty: null,
      presencePenalty: null,
      baseUrlHost: null,
    });
  });

  it("ignores a base URL it cannot parse", () => {
    expect(describeRequestedLlm({ clientConfig: { baseURL: "not a url" } }).baseUrlHost).toBeNull();
  });
});

describe("ta_turn_context schema", () => {
  it("rejects malformed jsonb", () => {
    const row = buildTurnContext(input());

    expect(
      taTurnContextValuesSchema.safeParse({ ...row, retrieval: { prefetch: null } }).success
    ).toBe(false);
    expect(taTurnContextValuesSchema.safeParse({ ...row, schemaVersion: 2 }).success).toBe(false);
    expect(
      taTurnContextValuesSchema.safeParse({ ...row, historyInteractionIds: [1, 2] }).success
    ).toBe(false);
  });
});

describe("persistTurn", () => {
  async function seedSession() {
    const org = await createOrg();
    const teacher = await createUser();
    const student = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    await addMember(student.id, org.id, "student");
    const classroom = await createClassroom({ organizationId: org.id, teacherUserId: teacher.id });
    const ch = await createChallenge({ classroomId: classroom.id, createdByUserId: teacher.id });
    const ta = await createTeachingAssistant({ organizationId: org.id });
    const ws = await createWorkSession({
      userId: student.id,
      challengeId: ch.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
    });
    return { ws, ch, ta };
  }

  function interaction(id: string, wsId: string, challengeId: string) {
    return {
      id,
      workSessionId: wsId,
      challengeId,
      interactionType: "chat",
      userPrompt: "help",
      modelResponse: "What would a loop need?",
      code: "def total(xs): pass",
      stdin: null,
      stdout: "None",
    };
  }

  it("writes the interaction and its context, and reads them back", async () => {
    const { ws, ch, ta } = await seedSession();
    const id = randomUUID();

    await persistTurn(
      interaction(id, ws.id, ch.id),
      buildTurnContext(input({ interactionId: id, teachingAssistantId: ta.id, challengeId: ch.id }))
    );

    const [stored] = await db
      .select()
      .from(taTurnContext)
      .where(eq(taTurnContext.interactionId, id));
    expect(stored).toMatchObject({
      schemaVersion: 1,
      teachingAssistantId: ta.id,
      promptContext,
      historyInteractionIds: ["h1", "h2"],
    });
    expect(stored?.retrieval.prefetch?.chunks[0]?.content).toBe("Use a for loop to accumulate.");
    expect(stored?.trajectory.map((m) => m.type)).toEqual(["ai", "tool", "ai"]);
  });

  it("refuses a context that belongs to another interaction", async () => {
    const { ws, ch, ta } = await seedSession();
    const id = randomUUID();

    await expect(
      persistTurn(
        interaction(id, ws.id, ch.id),
        buildTurnContext(input({ interactionId: randomUUID(), teachingAssistantId: ta.id }))
      )
    ).rejects.toThrow();
    expect(
      await db.select().from(userInteractionOnChallenge).where(eq(userInteractionOnChallenge.id, id))
    ).toHaveLength(0);
  });

  it("rolls back the interaction when the context cannot be written", async () => {
    const { ws, ch } = await seedSession();
    const id = randomUUID();

    await expect(
      persistTurn(
        interaction(id, ws.id, ch.id),
        // Unknown TA: the context insert fails on its foreign key.
        buildTurnContext(input({ interactionId: id, teachingAssistantId: randomUUID() }))
      )
    ).rejects.toThrow();
    expect(
      await db.select().from(userInteractionOnChallenge).where(eq(userInteractionOnChallenge.id, id))
    ).toHaveLength(0);
  });
});
