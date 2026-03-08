import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBase, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListKnowledgeBaseQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
});

const KnowledgeBaseItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ListKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: z.array(KnowledgeBaseItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: { id: string };
    Querystring: z.infer<typeof ListKnowledgeBaseQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["knowledge-base"],
        summary: "List knowledge base entries",
        description:
          "List knowledge base entries for a challenge with pagination",
        params: z.object({ id: z.string().uuid() }),
        querystring: ListKnowledgeBaseQuerySchema,
        response: {
          200: ListKnowledgeBaseResponseSchema,
          401: ResponseSchema401,
          404: ResponseSchema404,
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

      const { page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const whereClause = and(
        eq(knowledgeBase.challengeId, challengeId),
        isNull(knowledgeBase.deletedAt)
      );

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeBase)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const entries = await db
        .select({
          id: knowledgeBase.id,
          content: knowledgeBase.content,
          createdAt: knowledgeBase.createdAt,
          updatedAt: knowledgeBase.updatedAt,
        })
        .from(knowledgeBase)
        .where(whereClause)
        .orderBy(desc(knowledgeBase.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: entries.map((e) => ({
          id: e.id,
          content: e.content,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
