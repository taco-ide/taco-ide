import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import { knowledgeBaseDocument, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListDocumentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
});

const DocumentItemSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  chunkCount: z.number(),
  status: z.enum(["processing", "ready", "error"]),
  errorMessage: z.string().nullable(),
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
    Params: { id: string };
    Querystring: z.infer<typeof ListDocumentsQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["knowledge-base"],
        summary: "List knowledge base documents",
        description:
          "List uploaded documents for a challenge with pagination",
        params: z.object({ id: z.string().uuid() }),
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

      const challengeId = request.params.id;

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

      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message:
            "You can only manage knowledge base entries for your own challenges",
        });
      }

      const { page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const whereClause = and(
        eq(knowledgeBaseDocument.challengeId, challengeId),
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
          errorMessage: d.status === "error" ? "Document processing failed" : null,
          createdAt: d.createdAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
