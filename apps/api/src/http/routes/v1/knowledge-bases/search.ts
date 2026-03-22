import { z } from "zod";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBase, knowledgeBaseChunk } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../services/embedding";

// ==================== SCHEMAS ====================

const SearchKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().uuid(),
});

const SearchKnowledgeBaseQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const SearchResultItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
  chunkIndex: z.number().nullable(),
  documentId: z.string().nullable(),
  createdAt: z.string(),
});

const SearchKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: z.array(SearchResultItemSchema),
});

// ==================== ROUTE ====================

export async function searchKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof SearchKnowledgeBaseParamsSchema>;
    Querystring: z.infer<typeof SearchKnowledgeBaseQuerySchema>;
  }>(
    "/:kbId/search",
    {
      schema: {
        tags: ["knowledge-bases"],
        summary: "Semantic search knowledge base",
        description:
          "Search knowledge base chunks using semantic similarity",
        params: SearchKnowledgeBaseParamsSchema,
        querystring: SearchKnowledgeBaseQuerySchema,
        response: {
          200: SearchKnowledgeBaseResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          503: ResponseSchema503,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { kbId } = request.params;

      const kb = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
        })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
        .limit(1);

      if (!kb[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      if (kb[0].organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Knowledge base does not belong to your active organization",
        });
      }

      const { q, limit } = request.query;

      const queryEmbedding = await generateEmbedding(q);

      if (!queryEmbedding) {
        return reply.status(503).send({
          success: false as const,
          message: "Embedding service is unavailable",
        });
      }

      const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

      // Search chunks that belong to documents of this KB, or manual entries with knowledgeBaseId
      const results = await db
        .select({
          id: knowledgeBaseChunk.id,
          content: knowledgeBaseChunk.content,
          similarity:
            sql<number>`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector)`,
          chunkIndex: knowledgeBaseChunk.chunkIndex,
          documentId: knowledgeBaseChunk.documentId,
          createdAt: knowledgeBaseChunk.createdAt,
        })
        .from(knowledgeBaseChunk)
        .where(
          and(
            isNull(knowledgeBaseChunk.deletedAt),
            sql`${knowledgeBaseChunk.embedding} IS NOT NULL`,
            or(
              // Chunks from documents
              sql`${knowledgeBaseChunk.documentId} IN (
                SELECT id FROM knowledge_base_document
                WHERE knowledge_base_id = ${kbId} AND deleted_at IS NULL
              )`,
              // Manual entries
              eq(knowledgeBaseChunk.knowledgeBaseId, kbId)
            )
          )
        )
        .orderBy(
          sql`${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector`
        )
        .limit(limit);

      return reply.status(200).send({
        success: true as const,
        data: results.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: r.similarity,
          chunkIndex: r.chunkIndex,
          documentId: r.documentId,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  );
}
