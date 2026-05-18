import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
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
import { challenge, knowledgeBase } from "@repo/infra/db/schema";
import { searchChallengeKnowledgeBases } from "../../../../../services/knowledge-base-search";

// ==================== SCHEMAS ====================

const SearchChallengeKBParamsSchema = z.object({
  challengeId: z.string().min(1),
});

const SearchChallengeKBQuerySchema = z
  .object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(50).default(10),
  })
  .strict();

const SearchResultItemSchema = z.object({
  chunkId: z.string(),
  content: z.string(),
  similarity: z.number(),
  metadata: z
    .object({
      titleHierarchy: z.array(z.string()).optional(),
      documentFilename: z.string().optional(),
    })
    .nullable(),
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

      const { q, limit } = request.query;

      const results = await searchChallengeKnowledgeBases({
        challengeId,
        query: q,
        limit,
      });

      if (results.length === 0) {
        return reply.status(200).send({
          success: true as const,
          data: [],
        });
      }

      // Enrich results with KB titles
      const uniqueKbIds = [...new Set(results.map((r) => r.knowledgeBaseId))];
      const kbTitles = await db
        .select({ id: knowledgeBase.id, title: knowledgeBase.title })
        .from(knowledgeBase)
        .where(
          and(
            sql`${knowledgeBase.id} IN (${sql.join(uniqueKbIds.map((id) => sql`${id}`), sql`, `)})`,
            isNull(knowledgeBase.deletedAt)
          )
        );

      const titleMap = new Map(kbTitles.map((kb) => [kb.id, kb.title]));

      return reply.status(200).send({
        success: true as const,
        data: results.map((r) => ({
          chunkId: r.id,
          content: r.content,
          similarity: r.similarity,
          metadata: r.metadata,
          knowledgeBaseId: r.knowledgeBaseId,
          knowledgeBaseTitle: titleMap.get(r.knowledgeBaseId) ?? "",
          documentId: r.documentId,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  );
}
