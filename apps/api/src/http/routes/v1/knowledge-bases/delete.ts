import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().min(1),
});

// ==================== ROUTE ====================

export async function deleteKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteKnowledgeBaseParamsSchema>;
  }>(
    "/:kbId",
    {
      preHandler: [requirePermission("knowledgeBase", "delete")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Delete knowledge base",
        description: "Soft delete a knowledge base",
        params: DeleteKnowledgeBaseParamsSchema,
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

      const { kbId } = request.params;

      const existing = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
        })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      if (existing[0].organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Knowledge base does not belong to your active organization",
        });
      }

      if (
        usr.role === "teacher" &&
        existing[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only delete your own knowledge bases",
        });
      }

      await db
        .update(knowledgeBase)
        .set({ deletedAt: new Date() })
        .where(eq(knowledgeBase.id, kbId));

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
