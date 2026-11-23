/**
 * The SSE student chat route must bump `workSession.lastMessageAt` together
 * with the interaction it saves, so the derived activity status (#52) sees
 * chat activity.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  userInteractionOnChallenge,
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
  enrollStudent,
  TEST_PASSWORD,
} from "../../../../../test/helpers/factories";

const mocks = vi.hoisted(() => ({
  student: vi.fn(async function* () {
    yield {
      event: "on_chat_model_stream",
      data: { chunk: { content: "Test response" } },
    };
  }),
}));
vi.mock("../../../../../services/knowledge-base-search", () => ({
  searchChallengeKnowledgeBases: vi.fn(async () => []),
}));
vi.mock("../../../../../agents/llm-factory", () => ({
  createLlm: () => ({}),
  AGENT_TIMEOUT_MS: 1000,
  AgentTimeoutError: class extends Error {},
}));
vi.mock("../../../../../agents/langfuse", () => ({
  getLangfuseCallback: () => ({ flushAsync: vi.fn(async () => {}) }),
}));
vi.mock("../../../../../agents/teaching-assistant/agent", () => ({
  buildTeachingAssistantAgent: () => ({ streamEvents: mocks.student }),
}));
vi.mock("../../../../../agents/teachers-companion/agent", () => ({
  buildTeachersCompanionAgent: () => ({ streamEvents: vi.fn() }),
}));
vi.mock("../../../../../agents/teachers-companion/reference-solution", () => ({
  generateReferenceSolutions: vi.fn(),
}));

describe("POST /v1/chat/student/message", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  it("sets lastMessageAt when it saves the chat interaction", async () => {
    const org = await createOrg();
    const teacher = await createUser();
    const student = await createUser();
    await addMember(teacher.id, org.id, "teacher");
    await addMember(student.id, org.id, "student");
    const classroom = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    await enrollStudent(student.id, classroom.id);
    const challenge = await createChallenge({
      classroomId: classroom.id,
      createdByUserId: teacher.id,
    });
    const ta = await createTeachingAssistant({ organizationId: org.id });
    const ws = await createWorkSession({
      userId: student.id,
      challengeId: challenge.id,
      classroomId: classroom.id,
      teachingAssistantId: ta.id,
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    });
    expect(ws.lastMessageAt).toBeNull();

    const cookie = await loginAs({ email: student.email, password: TEST_PASSWORD });
    const before = Date.now();
    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/student/message",
      headers: { cookie },
      payload: { workSessionId: ws.id, message: "hello" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('"type":"done"');
    expect(res.body).not.toContain('"type":"error"');

    const interactions = await db
      .select()
      .from(userInteractionOnChallenge)
      .where(eq(userInteractionOnChallenge.workSessionId, ws.id));
    expect(interactions).toHaveLength(1);

    const [row] = await db
      .select({ lastMessageAt: workSession.lastMessageAt })
      .from(workSession)
      .where(eq(workSession.id, ws.id));
    expect(row!.lastMessageAt).not.toBeNull();
    expect(row!.lastMessageAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
