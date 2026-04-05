import { eq, and, isNull, sql, inArray, or } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  knowledgeBase,
  knowledgeBaseChunk,
  challengeKnowledgeBase,
} from "@repo/infra/db/schema";
import { generateEmbedding } from "./embedding";

export interface KBSearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: { titleHierarchy?: string[]; documentFilename?: string } | null;
  chunkIndex: number | null;
  documentId: string | null;
  knowledgeBaseId: string;
  createdAt: Date;
}

interface SearchKnowledgeBaseInput {
  kbId: string;
  query: string;
  limit?: number;
  similarityThreshold?: number;
}

interface SearchChallengeKBInput {
  challengeId: string;
  query: string;
  limit?: number;
  similarityThreshold?: number;
}

export async function searchKnowledgeBase({
  kbId,
  query,
  limit = 10,
  similarityThreshold = 0.3,
}: SearchKnowledgeBaseInput): Promise<KBSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    return [];
  }

  const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

  const results = await db
    .select({
      id: knowledgeBaseChunk.id,
      content: knowledgeBaseChunk.content,
      similarity:
        sql<number>`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector)`,
      metadata: knowledgeBaseChunk.metadata,
      chunkIndex: knowledgeBaseChunk.chunkIndex,
      documentId: knowledgeBaseChunk.documentId,
      knowledgeBaseId: sql<string>`COALESCE(${knowledgeBaseChunk.knowledgeBaseId}, (
        SELECT kbd.knowledge_base_id FROM knowledge_base_document kbd
        WHERE kbd.id = ${knowledgeBaseChunk.documentId}
      ))`,
      createdAt: knowledgeBaseChunk.createdAt,
    })
    .from(knowledgeBaseChunk)
    .where(
      and(
        isNull(knowledgeBaseChunk.deletedAt),
        sql`${knowledgeBaseChunk.embedding} IS NOT NULL`,
        similarityThreshold > 0
          ? sql`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector) >= ${similarityThreshold}`
          : undefined,
        or(
          sql`${knowledgeBaseChunk.documentId} IN (
            SELECT id FROM knowledge_base_document
            WHERE knowledge_base_id = ${kbId} AND deleted_at IS NULL
          )`,
          eq(knowledgeBaseChunk.knowledgeBaseId, kbId)
        )
      )
    )
    .orderBy(
      sql`${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector`
    )
    .limit(limit);

  return results;
}

export async function searchChallengeKnowledgeBases({
  challengeId,
  query,
  limit = 10,
  similarityThreshold = 0.3,
}: SearchChallengeKBInput): Promise<KBSearchResult[]> {
  const linkedKBs = await db
    .select({ knowledgeBaseId: challengeKnowledgeBase.knowledgeBaseId })
    .from(challengeKnowledgeBase)
    .innerJoin(
      knowledgeBase,
      and(
        eq(challengeKnowledgeBase.knowledgeBaseId, knowledgeBase.id),
        isNull(knowledgeBase.deletedAt)
      )
    )
    .where(eq(challengeKnowledgeBase.challengeId, challengeId));

  if (linkedKBs.length === 0) {
    return [];
  }

  const kbIds = linkedKBs.map((r) => r.knowledgeBaseId);

  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    return [];
  }

  const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

  const results = await db
    .select({
      id: knowledgeBaseChunk.id,
      content: knowledgeBaseChunk.content,
      similarity:
        sql<number>`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector)`,
      metadata: knowledgeBaseChunk.metadata,
      chunkIndex: knowledgeBaseChunk.chunkIndex,
      documentId: knowledgeBaseChunk.documentId,
      knowledgeBaseId: sql<string>`COALESCE(${knowledgeBaseChunk.knowledgeBaseId}, (
        SELECT kbd.knowledge_base_id FROM knowledge_base_document kbd
        WHERE kbd.id = ${knowledgeBaseChunk.documentId}
      ))`,
      createdAt: knowledgeBaseChunk.createdAt,
    })
    .from(knowledgeBaseChunk)
    .where(
      and(
        isNull(knowledgeBaseChunk.deletedAt),
        sql`${knowledgeBaseChunk.embedding} IS NOT NULL`,
        similarityThreshold > 0
          ? sql`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector) >= ${similarityThreshold}`
          : undefined,
        or(
          sql`${knowledgeBaseChunk.documentId} IN (
            SELECT kbd.id FROM knowledge_base_document kbd
            WHERE kbd.knowledge_base_id IN (${sql.join(kbIds.map((id) => sql`${id}`), sql`, `)})
            AND kbd.deleted_at IS NULL
          )`,
          inArray(knowledgeBaseChunk.knowledgeBaseId, kbIds)
        )
      )
    )
    .orderBy(
      sql`${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector`
    )
    .limit(limit);

  return results;
}
