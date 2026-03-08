import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBase, challenge } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../services/embedding";

// ==================== SCHEMAS ====================

const SearchKnowledgeBaseQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const SearchResultItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
  createdAt: z.string(),
});

const SearchKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: z.array(SearchResultItemSchema),
});

// ==================== ROUTE ====================

export async function searchKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: { id: string };
    Querystring: z.infer<typeof SearchKnowledgeBaseQuerySchema>;
  }>(
    "/search",
    {
      schema: {
        tags: ["knowledge-base"],
        summary: "Semantic search knowledge base",
        description:
          "Search knowledge base entries for a challenge using semantic similarity",
        params: z.object({ id: z.string().uuid() }),
        querystring: SearchKnowledgeBaseQuerySchema,
        response: {
          200: SearchKnowledgeBaseResponseSchema,
          401: ResponseSchema401,
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

      const challengeId = request.params.id;

      const ch = await db
        .select({ id: challenge.id })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
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

      const results = await db
        .select({
          id: knowledgeBase.id,
          content: knowledgeBase.content,
          similarity:
            sql<number>`1 - (${knowledgeBase.embedding} <=> ${queryEmbeddingString}::vector)`,
          createdAt: knowledgeBase.createdAt,
        })
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.challengeId, challengeId),
            sql`${knowledgeBase.embedding} IS NOT NULL`,
            isNull(knowledgeBase.deletedAt)
          )
        )
        .orderBy(
          sql`${knowledgeBase.embedding} <=> ${queryEmbeddingString}::vector`
        )
        .limit(limit);

      return reply.status(200).send({
        success: true as const,
        data: results.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: r.similarity,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  );
}
