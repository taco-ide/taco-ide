import {
  loadChallengeWorkAccessContext,
  assertCanListChallengeWorkSessions,
} from "../../../../services/work-session-access";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import { challengeKnowledgeBase } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const UnlinkKnowledgeBaseParamsSchema = z.object({
  challengeId: z.string().min(1),
  kbId: z.string().min(1),
});

// ==================== ROUTE ====================

export async function unlinkKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof UnlinkKnowledgeBaseParamsSchema>;
  }>(
    "/:kbId",
    {
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

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Challenge not found" });
      const access = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

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
