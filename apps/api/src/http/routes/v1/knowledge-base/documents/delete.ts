import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { extname } from "node:path";
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
  challenge,
} from "@repo/infra/db/schema";
import { deleteFile } from "../../../../../services/file-storage";
import { join } from "node:path";

// ==================== SCHEMAS ====================

const DeleteDocumentParamsSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
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
        tags: ["knowledge-base"],
        summary: "Delete knowledge base document",
        description:
          "Soft delete a document and its chunks from the challenge knowledge base",
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

      const { id: challengeId, docId } = request.params;

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

      const existing = await db
        .select({
          id: knowledgeBaseDocument.id,
          challengeId: knowledgeBaseDocument.challengeId,
          organizationId: knowledgeBaseDocument.organizationId,
          filename: knowledgeBaseDocument.filename,
        })
        .from(knowledgeBaseDocument)
        .where(
          and(
            eq(knowledgeBaseDocument.id, docId),
            eq(knowledgeBaseDocument.challengeId, challengeId),
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
        .update(knowledgeBase)
        .set({ deletedAt: now })
        .where(eq(knowledgeBase.documentId, docId));

      // Delete physical file (best-effort)
      const orgId = existing[0].organizationId;
      if (!orgId) {
        request.server.log.warn(
          { documentId: docId },
          "Document has no organizationId, skipping file deletion"
        );
        return reply.status(204).send({ success: true as const });
      }
      const ext = extname(existing[0].filename);
      const filePath = join(
        process.cwd(),
        "uploads",
        "documents",
        orgId,
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
