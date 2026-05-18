import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { extname, join } from "node:path";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  knowledgeBase,
  knowledgeBaseDocument,
  knowledgeBaseChunk,
} from "@repo/infra/db/schema";
import { deleteFile } from "../../../../../services/file-storage";

// ==================== SCHEMAS ====================

const DeleteDocumentParamsSchema = z.object({
  kbId: z.string().min(1),
  docId: z.string().min(1),
});

// ==================== ROUTE ====================

export async function deleteDocumentRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteDocumentParamsSchema>;
  }>(
    "/:docId",
    {
      preHandler: [requirePermission("knowledgeBase", "delete")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Delete knowledge base document",
        description:
          "Soft delete a document and its chunks from the knowledge base",
        params: DeleteDocumentParamsSchema,
        response: {
          204: ResponseSchema204,
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

      const { kbId, docId } = request.params;

      const kb = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
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

      if (usr.role === "teacher" && kb[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only manage documents in your own knowledge bases",
        });
      }

      const existing = await db
        .select({
          id: knowledgeBaseDocument.id,
          filename: knowledgeBaseDocument.filename,
        })
        .from(knowledgeBaseDocument)
        .where(
          and(
            eq(knowledgeBaseDocument.id, docId),
            eq(knowledgeBaseDocument.knowledgeBaseId, kbId),
            isNull(knowledgeBaseDocument.deletedAt)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Document not found",
        });
      }

      const now = new Date();

      // Soft delete document
      await db
        .update(knowledgeBaseDocument)
        .set({ deletedAt: now })
        .where(eq(knowledgeBaseDocument.id, docId));

      // Soft delete associated chunks
      await db
        .update(knowledgeBaseChunk)
        .set({ deletedAt: now })
        .where(eq(knowledgeBaseChunk.documentId, docId));

      // Delete physical file (best-effort)
      const orgId = kb[0].organizationId;
      const ext = extname(existing[0].filename);
      const filePath = join(
        process.cwd(),
        "uploads",
        "documents",
        orgId,
        kbId,
        `${docId}${ext}`
      );
      deleteFile(filePath).catch((err) =>
        request.server.log.warn(
          { err, documentId: docId },
          "Failed to delete document file"
        )
      );

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
