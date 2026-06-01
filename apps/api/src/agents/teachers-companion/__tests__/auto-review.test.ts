/**
 * Tests for runAutoReview. Mocks the llm-factory so we don't hit the real
 * LLM and so we can simulate success / error / timeout paths.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { submission } from "@repo/infra/db/schema";

// Provide a controllable mock of createLlm before importing the module
// under test. The mock returns an LLM-shaped object whose `invoke` is a
// vi.fn we can rewire per-test via `invokeMock`.
const invokeMock = vi.fn();

vi.mock("../../llm-factory", async () => {
  const actual = (await vi.importActual("../../llm-factory")) as Record<string, unknown>;
  return {
    ...actual,
    createLlm: () => ({ invoke: invokeMock }),
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

describe("runAutoReview", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let teacher: Awaited<ReturnType<typeof createUser>>;
  let student: Awaited<ReturnType<typeof createUser>>;
  let ta: Awaited<ReturnType<typeof createTeachingAssistant>>;
  let ch: Awaited<ReturnType<typeof createChallenge>>;
  let session: Awaited<ReturnType<typeof createWorkSession>>;
  let sub: Awaited<ReturnType<typeof createSubmission>>;

  beforeAll(() => {
    // Silence the console.error path used by the auto-review error branch
    // so test output stays focused.
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

  it("writes autoReview + autoReviewAt on the happy path", async () => {
    invokeMock.mockResolvedValueOnce({ content: "Great work, careful with edge cases." });

    await runAutoReview(sub.id);

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReview).toBe("Great work, careful with edge cases.");
    expect(row!.autoReviewAt).toBeInstanceOf(Date);
  });

  it("handles array-content responses (multipart text)", async () => {
    invokeMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Parte 1. " },
        { type: "text", text: "Parte 2." },
      ],
    });

    await runAutoReview(sub.id);

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReview).toBe("Parte 1. Parte 2.");
  });

  it("swallows LLM errors and leaves autoReview null", async () => {
    invokeMock.mockRejectedValueOnce(new Error("LLM unavailable"));

    await expect(runAutoReview(sub.id)).resolves.toBeUndefined();

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReview).toBeNull();
    expect(row!.autoReviewAt).toBeNull();
  });

  it("does not write when the LLM returns empty content", async () => {
    invokeMock.mockResolvedValueOnce({ content: "" });

    await runAutoReview(sub.id);

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, sub.id));
    expect(row!.autoReview).toBeNull();
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
    invokeMock.mockResolvedValueOnce({ content: "should not be written" });

    await runAutoReview("00000000-0000-0000-0000-000000000000");

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
