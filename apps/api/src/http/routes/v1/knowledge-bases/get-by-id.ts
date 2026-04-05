import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  knowledgeBase,
  knowledgeBaseDocument,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const GetKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().uuid(),
});

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

const KnowledgeBaseDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  classroomId: z.string(),
  organizationId: z.string(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  documents: z.array(DocumentItemSchema),
});

const GetKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: KnowledgeBaseDetailSchema,
});

// ==================== ROUTE ====================

export async function getKnowledgeBaseByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof GetKnowledgeBaseParamsSchema>;
  }>(
    "/:kbId",
    {
      schema: {
        tags: ["knowledge-bases"],
        summary: "Get knowledge base by ID",
        description: "Get a knowledge base with its documents",
        params: GetKnowledgeBaseParamsSchema,
        response: {
          200: GetKnowledgeBaseResponseSchema,
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

      const kb = await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          description: knowledgeBase.description,
          classroomId: knowledgeBase.classroomId,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
          createdAt: knowledgeBase.createdAt,
          updatedAt: knowledgeBase.updatedAt,
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
        .where(
          and(
            eq(knowledgeBaseDocument.knowledgeBaseId, kbId),
            isNull(knowledgeBaseDocument.deletedAt)
          )
        )
        .orderBy(desc(knowledgeBaseDocument.createdAt));

      return reply.status(200).send({
        success: true as const,
        data: {
          id: kb[0].id,
          title: kb[0].title,
          description: kb[0].description,
          classroomId: kb[0].classroomId,
          organizationId: kb[0].organizationId,
          createdByUserId: kb[0].createdByUserId,
          createdAt: kb[0].createdAt.toISOString(),
          updatedAt: kb[0].updatedAt.toISOString(),
          documents: documents.map((d) => ({
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
        },
      });
    }
  );
}
