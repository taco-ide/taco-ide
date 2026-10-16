import { assertKnowledgeBaseResourceAccess } from "../../../../services/knowledge-base-access";
import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBaseDocument } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListDocumentsParamsSchema = z.object({
  kbId: z.string().min(1),
});

const ListDocumentsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    perPage: z.coerce.number().min(1).max(100).default(20),
  })
  .strict();

const DocumentItemSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  chunkCount: z.number(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  errorStage: z.string().nullable(),
  createdAt: z.string(),
});

const ListDocumentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(DocumentItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listDocumentsRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ListDocumentsParamsSchema>;
    Querystring: z.infer<typeof ListDocumentsQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["knowledge-bases"],
        summary: "List knowledge base documents",
        description:
          "List uploaded documents for a knowledge base with pagination",
        params: ListDocumentsParamsSchema,
        querystring: ListDocumentsQuerySchema,
        response: {
          200: ListDocumentsResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
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

      const { kbId } = request.params;

      const access = await assertKnowledgeBaseResourceAccess(usr, kbId, "read");
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const { page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const whereClause = and(
        eq(knowledgeBaseDocument.knowledgeBaseId, kbId),
        isNull(knowledgeBaseDocument.deletedAt)
      );

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeBaseDocument)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const documents = await db
        .select({
          id: knowledgeBaseDocument.id,
          filename: knowledgeBaseDocument.filename,
          mimeType: knowledgeBaseDocument.mimeType,
          fileSize: knowledgeBaseDocument.fileSize,
          chunkCount: knowledgeBaseDocument.chunkCount,
          status: knowledgeBaseDocument.status,
          errorMessage: knowledgeBaseDocument.errorMessage,
          errorStage: knowledgeBaseDocument.errorStage,
          createdAt: knowledgeBaseDocument.createdAt,
        })
        .from(knowledgeBaseDocument)
        .where(whereClause)
        .orderBy(desc(knowledgeBaseDocument.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: documents.map((d) => ({
          id: d.id,
          filename: d.filename,
          mimeType: d.mimeType,
          fileSize: d.fileSize,
          chunkCount: d.chunkCount,
          status: d.status,
          errorMessage: d.errorMessage,
          errorStage: d.errorStage,
          createdAt: d.createdAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
