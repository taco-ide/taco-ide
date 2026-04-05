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
import { challenge, challengeKnowledgeBase } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const UnlinkKnowledgeBaseParamsSchema = z.object({
  challengeId: z.string().uuid(),
  kbId: z.string().uuid(),
});

// ==================== ROUTE ====================

export async function unlinkKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof UnlinkKnowledgeBaseParamsSchema>;
  }>(
    "/:kbId",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenge-knowledge-bases"],
        summary: "Unlink knowledge base from challenge",
        description:
          "Remove the association between a knowledge base and a challenge. Does not delete the knowledge base itself.",
        params: UnlinkKnowledgeBaseParamsSchema,
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

      const { challengeId, kbId } = request.params;

      // Fetch challenge, validate exists and not deleted
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

      // IDOR: teacher can only manage own challenges
      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message:
            "You can only manage knowledge bases for your own challenges",
        });
      }

      // Delete M2M record
      const deleted = await db
        .delete(challengeKnowledgeBase)
        .where(
          and(
            eq(challengeKnowledgeBase.challengeId, challengeId),
            eq(challengeKnowledgeBase.knowledgeBaseId, kbId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base link not found",
        });
      }

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
