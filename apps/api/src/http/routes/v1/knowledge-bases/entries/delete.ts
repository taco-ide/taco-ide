import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase, knowledgeBaseChunk } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteEntryParamsSchema = z.object({
  kbId: z.string().min(1),
  entryId: z.string().min(1),
});

// ==================== ROUTE ====================

export async function deleteEntryRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteEntryParamsSchema>;
  }>(
    "/:entryId",
    {
      preHandler: [requirePermission("knowledgeBase", "delete")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Delete manual knowledge base entry",
        description: "Soft delete a manual chunk entry",
        params: DeleteEntryParamsSchema,
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

      const { kbId, entryId } = request.params;

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
          message: "You can only manage entries in your own knowledge bases",
        });
      }

      // Manual entries have documentId IS NULL and knowledgeBaseId set
      const existing = await db
        .select({ id: knowledgeBaseChunk.id })
        .from(knowledgeBaseChunk)
        .where(
          and(
            eq(knowledgeBaseChunk.id, entryId),
            eq(knowledgeBaseChunk.knowledgeBaseId, kbId),
            isNull(knowledgeBaseChunk.documentId),
            isNull(knowledgeBaseChunk.deletedAt)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Entry not found",
        });
      }

      await db
        .update(knowledgeBaseChunk)
        .set({ deletedAt: new Date() })
        .where(eq(knowledgeBaseChunk.id, entryId));

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
