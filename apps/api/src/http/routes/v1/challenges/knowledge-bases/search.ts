import { z } from "zod";
import { eq, and, isNull, or, sql, inArray } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema503,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  challenge,
  knowledgeBase,
  knowledgeBaseChunk,
  challengeKnowledgeBase,
} from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../../services/embedding";

// ==================== SCHEMAS ====================

const SearchChallengeKBParamsSchema = z.object({
  challengeId: z.string().uuid(),
});

const SearchChallengeKBQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const SearchResultItemSchema = z.object({
  chunkId: z.string(),
  content: z.string(),
  similarity: z.number(),
  knowledgeBaseId: z.string(),
  knowledgeBaseTitle: z.string(),
  documentId: z.string().nullable(),
  createdAt: z.string(),
});

const SearchChallengeKBResponseSchema = ResponseSchema200.extend({
  data: z.array(SearchResultItemSchema),
});

// ==================== ROUTE ====================

export async function searchChallengeKnowledgeBasesRoute(
  app: FastifyTypedInstance
) {
  app.get<{
    Params: z.infer<typeof SearchChallengeKBParamsSchema>;
    Querystring: z.infer<typeof SearchChallengeKBQuerySchema>;
  }>(
    "/search",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenge-knowledge-bases"],
        summary: "Semantic search across challenge knowledge bases",
        description:
          "Search across all knowledge bases linked to a challenge using semantic similarity.",
        params: SearchChallengeKBParamsSchema,
        querystring: SearchChallengeKBQuerySchema,
        response: {
          200: SearchChallengeKBResponseSchema,
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

      const { challengeId } = request.params;

      // Fetch challenge, validate exists and not deleted
      const ch = await db
        .select({
          id: challenge.id,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      // IDOR: teacher can only search own challenges' KBs
      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message:
            "You can only search knowledge bases for your own challenges",
        });
      }

      // Get all KB IDs linked to this challenge
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
        return reply.status(200).send({
          success: true as const,
          data: [],
        });
      }

      const kbIds = linkedKBs.map((r) => r.knowledgeBaseId);

      const { q, limit } = request.query;

      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(q);

      if (!queryEmbedding) {
        return reply.status(503).send({
          success: false as const,
          message: "Embedding service is unavailable",
        });
      }

      const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

      // Search chunks across all linked KBs (documents + manual entries)
      const results = await db
        .select({
          chunkId: knowledgeBaseChunk.id,
          content: knowledgeBaseChunk.content,
          similarity:
            sql<number>`1 - (${knowledgeBaseChunk.embedding} <=> ${queryEmbeddingString}::vector)`,
          knowledgeBaseId:
            sql<string>`COALESCE(${knowledgeBaseChunk.knowledgeBaseId}, (
              SELECT kbd.knowledge_base_id FROM knowledge_base_document kbd
              WHERE kbd.id = ${knowledgeBaseChunk.documentId}
            ))`,
          knowledgeBaseTitle:
            sql<string>`(
              SELECT kb.title FROM knowledge_base kb
              WHERE kb.id = COALESCE(${knowledgeBaseChunk.knowledgeBaseId}, (
                SELECT kbd.knowledge_base_id FROM knowledge_base_document kbd
                WHERE kbd.id = ${knowledgeBaseChunk.documentId}
              )) AND kb.deleted_at IS NULL
            )`,
          documentId: knowledgeBaseChunk.documentId,
          createdAt: knowledgeBaseChunk.createdAt,
        })
        .from(knowledgeBaseChunk)
        .where(
          and(
            isNull(knowledgeBaseChunk.deletedAt),
            sql`${knowledgeBaseChunk.embedding} IS NOT NULL`,
            or(
              // Chunks from documents belonging to linked KBs
              sql`${knowledgeBaseChunk.documentId} IN (
                SELECT kbd.id FROM knowledge_base_document kbd
                WHERE kbd.knowledge_base_id IN (${sql.join(kbIds.map((id) => sql`${id}`), sql`, `)})
                AND kbd.deleted_at IS NULL
              )`,
              // Manual entries directly linked to KBs
              inArray(knowledgeBaseChunk.knowledgeBaseId, kbIds)
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
          chunkId: r.chunkId,
          content: r.content,
          similarity: r.similarity,
          knowledgeBaseId: r.knowledgeBaseId,
          knowledgeBaseTitle: r.knowledgeBaseTitle,
          documentId: r.documentId,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  );
}
