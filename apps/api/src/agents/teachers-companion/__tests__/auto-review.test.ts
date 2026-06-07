/**
 * Tests for runAutoReview. Mocks the llm-factory so we don't hit the real
 * LLM and so we can simulate success / schema-failure / error paths.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { submission } from "@repo/infra/db/schema";

// Provide a controllable mock of createLlm before importing the module
// under test. createLlm returns an object whose withStructuredOutput()
// returns the structured-LLM whose `invoke` is rewired per-test via
// invokeMock.
const invokeMock = vi.fn();

vi.mock("../../llm-factory", async () => {
  const actual = (await vi.importActual("../../llm-factory")) as Record<string, unknown>;
  return {
    ...actual,
    createLlm: () => ({
      withStructuredOutput: () => ({ invoke: invokeMock }),
    }),
  };
});

import { runAutoReview } from "../auto-review";
import {
  addInteraction,
  createChallenge,
  createClassroom,
  createOrg,
  createSubmission,
  createTeachingAssistant,
  createUser,
  createWorkSession,
  linkChallengeToTa,
} from "../../../test/helpers/factories";

const VALID_REVIEW = {
  pontosFortes: ["Uso correto de loops"],
  problemas: [
    {
      tipo: "correção",
      gravidade: "media" as const,
      linha: 3,
      descricao: "Não trata entrada vazia",
    },
  ],
  sugestoes: ["Testar com lista vazia"],
  avaliacaoGeral: "Boa primeira tentativa, mas falta cobertura de borda.",
};

describe("runAutoReview", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let ta: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let ch: Awaited<ReturnType<typeof createChallenge>>;
  let session: Awaited<ReturnType<typeof createWorkSession>>;
  let sub: Awaited<ReturnType<typeof createSubmission>>;

  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invokeMock.mockReset();
    org = await createOrg();
    teacher = await createUser();
    student = await createUser();
    const classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    ta = await createTeachingAssistant({ organizationId: org.id });
    ch = await createChallenge({
      createdByUserId: teacher.id,
      classroomId: classroom.id,
    });
    await linkChallengeToTa(ch.id, ta.id);
    session = await createWorkSession({
      userId: student.id,
      challengeId: ch.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      endedAt: new Date(),
    });
    await addInteraction({
      workSessionId: session.id,
      challengeId: ch.id,
      interactionType: "chat",
      userPrompt: "como começo?",
      modelResponse: "tente um loop",
    });
    sub = await createSubmission({
      workSessionId: session.id,
      challengeId: ch.id,
      studentUserId: student.id,
      code: "print(42)",
    });
  });

  it("writes both structured JSON and markdown fallback on the happy path", async () => {
    invokeMock.mockResolvedValueOnce(VALID_REVIEW);

    await runAutoReview(sub.id);

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReviewStatus).toBe("complete");
    expect(row!.autoReviewJson).toMatchObject({
      avaliacaoGeral: VALID_REVIEW.avaliacaoGeral,
      pontosFortes: VALID_REVIEW.pontosFortes,
      sugestoes: VALID_REVIEW.sugestoes,
    });
    expect(row!.autoReview).toContain("Avaliação geral");
    expect(row!.autoReview).toContain("Pontos fortes");
    expect(row!.autoReviewAt).toBeInstanceOf(Date);
  });

  it("marks as failed when the LLM returns a payload that fails validation", async () => {
    invokeMock.mockResolvedValueOnce({
      pontosFortes: ["ok"],
      // missing required fields
    });

    await runAutoReview(sub.id);

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReviewStatus).toBe("failed");
    expect(row!.autoReviewError).toMatch(/formato/);
    expect(row!.autoReview).toBeNull();
    expect(row!.autoReviewJson).toBeNull();
  });

  it("swallows LLM errors and marks the submission as failed", async () => {
    invokeMock.mockRejectedValueOnce(new Error("LLM unavailable"));

    await expect(runAutoReview(sub.id)).resolves.toBeUndefined();

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReviewStatus).toBe("failed");
    expect(row!.autoReview).toBeNull();
    expect(row!.autoReviewJson).toBeNull();
    expect(row!.autoReviewAt).toBeNull();
  });

  it("respects the AbortController timeout (signal passed to invoke)", async () => {
    let observedSignal: AbortSignal | undefined;
    invokeMock.mockImplementationOnce(async (_messages, opts: { signal?: AbortSignal }) => {
      observedSignal = opts?.signal;
      throw new Error("aborted");
    });

    await runAutoReview(sub.id);

    expect(observedSignal).toBeInstanceOf(AbortSignal);
  });

  it("is a no-op for an unknown submission id", async () => {
    invokeMock.mockResolvedValueOnce(VALID_REVIEW);

    await runAutoReview("00000000-0000-0000-0000-000000000000");

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
