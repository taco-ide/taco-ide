import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  knowledgeBase,
  knowledgeBaseChunk,
  challengeKnowledgeBase,
} from "@repo/infra/db/schema";
import {
  createOrg,
  createUser,
  createClassroom,
  createChallenge,
} from "../../test/helpers/factories";
import { searchChallengeKnowledgeBases } from "../knowledge-base-search";
const mocks = vi.hoisted(() => ({
  embedding: vi.fn(async () => [1, ...Array<number>(1535).fill(0)]),
}));
vi.mock("../embedding", () => ({ generateEmbedding: mocks.embedding }));

describe("agent knowledge-base search uses current classroom", () => {
  let classId: string;
  let challengeId: string;
  let knowledgeBaseId: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    const org = await createOrg();
    const teacher = await createUser();
    const cls = await createClassroom({
      organizationId: org.id,
      teacherUserId: teacher.id,
    });
    const ch = await createChallenge({
      classroomId: cls.id,
      createdByUserId: teacher.id,
    });
    classId = cls.id;
    challengeId = ch.id;
    knowledgeBaseId = randomUUID();
    await db.insert(knowledgeBase).values({
      id: knowledgeBaseId,
      title: "KB",
      classroomId: classId,
      organizationId: org.id,
      createdByUserId: teacher.id,
    });
    await db
      .insert(challengeKnowledgeBase)
      .values({ challengeId, knowledgeBaseId });
    await db.insert(knowledgeBaseChunk).values({
      id: randomUUID(),
      knowledgeBaseId,
      content: "Accessible material",
      embedding: [1, ...Array<number>(1535).fill(0)],
    });
  });
  it("returns relevant chunks for an active current classroom", async () => {
    const results = await searchChallengeKnowledgeBases({
      challengeId,
      query: "test",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("Accessible material");
    expect(mocks.embedding).toHaveBeenCalledOnce();
  });
  it("preserves old links but ignores them after unassignment", async () => {
    await db
      .update(challenge)
      .set({ classroomId: null })
      .where(eq(challenge.id, challengeId));
    expect(
      await searchChallengeKnowledgeBases({ challengeId, query: "test" })
    ).toEqual([]);
    expect(mocks.embedding).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(challengeKnowledgeBase)
        .where(eq(challengeKnowledgeBase.challengeId, challengeId))
    ).toHaveLength(1);
  });
  it("does not retrieve deleted classroom material", async () => {
    await db
      .update(classroom)
      .set({ deletedAt: new Date() })
      .where(eq(classroom.id, classId));
    expect(
      await searchChallengeKnowledgeBases({ challengeId, query: "test" })
    ).toEqual([]);
    expect(mocks.embedding).not.toHaveBeenCalled();
  });
});
