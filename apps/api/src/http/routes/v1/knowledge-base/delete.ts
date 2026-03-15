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
import { knowledgeBase, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteKnowledgeBaseParamsSchema = z.object({
  id: z.string().uuid(),
  kbId: z.string().uuid(),
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
        tags: ["knowledge-base"],
        summary: "Delete knowledge base entry",
        description:
          "Soft delete a knowledge base entry for a challenge",
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

      const { id: challengeId, kbId } = request.params;

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

      if (
        usr.role === "teacher" &&
        ch[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only manage knowledge base entries for your own challenges",
        });
      }

      const existing = await db
        .select({ id: knowledgeBase.id, challengeId: knowledgeBase.challengeId })
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.id, kbId),
            eq(knowledgeBase.challengeId, challengeId),
            isNull(knowledgeBase.deletedAt)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base entry not found",
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
