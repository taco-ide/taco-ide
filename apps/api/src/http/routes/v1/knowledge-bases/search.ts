import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBase } from "@repo/infra/db/schema";
import { searchKnowledgeBase } from "../../../../services/knowledge-base-search";

// ==================== SCHEMAS ====================

const SearchKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().min(1),
});

const SearchKnowledgeBaseQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const SearchResultItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
  metadata: z
    .object({
      titleHierarchy: z.array(z.string()).optional(),
      documentFilename: z.string().optional(),
    })
    .nullable(),
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

      const results = await searchKnowledgeBase({ kbId, query: q, limit });

      if (results.length === 0) {
        return reply.status(200).send({
          success: true as const,
          data: [],
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: results.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: r.similarity,
          metadata: r.metadata,
          chunkIndex: r.chunkIndex,
          documentId: r.documentId,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  );
}
