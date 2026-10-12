import { assertKnowledgeBaseResourceAccess } from "../../../services/knowledge-base-access";
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
import { knowledgeBaseDocument } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const GetKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().min(1),
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

      const access = await assertKnowledgeBaseResourceAccess(usr, kbId, "read");
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });
      const { knowledgeBase: kb } = access;

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
          id: kb.id,
          title: kb.title,
          description: kb.description,
          classroomId: kb.classroomId,
          organizationId: kb.organizationId,
          createdByUserId: kb.createdByUserId,
          createdAt: kb.createdAt.toISOString(),
          updatedAt: kb.updatedAt.toISOString(),
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
