import { z } from "zod";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  knowledgeBase,
  knowledgeBaseDocument,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListKnowledgeBasesQuerySchema = z.object({
  classroomId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
});

const KnowledgeBaseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  classroomId: z.string(),
  documentCount: z.number(),
  createdAt: z.string(),
});

const ListKnowledgeBasesResponseSchema = ResponseSchema200.extend({
  data: z.array(KnowledgeBaseItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listKnowledgeBasesRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof ListKnowledgeBasesQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["knowledge-bases"],
        summary: "List knowledge bases",
        description:
          "List knowledge bases for a classroom with pagination and document count",
        querystring: ListKnowledgeBasesQuerySchema,
        response: {
          200: ListKnowledgeBasesResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
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

      const { classroomId, page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const whereClause = and(
        eq(knowledgeBase.classroomId, classroomId),
        isNull(knowledgeBase.deletedAt)
      );

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeBase)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const kbs = await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          description: knowledgeBase.description,
          classroomId: knowledgeBase.classroomId,
          createdAt: knowledgeBase.createdAt,
          documentCount: sql<number>`(
            SELECT count(*)::int FROM knowledge_base_document
            WHERE knowledge_base_document.knowledge_base_id = ${knowledgeBase.id}
            AND knowledge_base_document.deleted_at IS NULL
          )`,
        })
        .from(knowledgeBase)
        .where(whereClause)
        .orderBy(desc(knowledgeBase.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: kbs.map((kb) => ({
          id: kb.id,
          title: kb.title,
          description: kb.description,
          classroomId: kb.classroomId,
          documentCount: kb.documentCount,
          createdAt: kb.createdAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
