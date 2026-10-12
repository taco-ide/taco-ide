import {
  loadChallengeWorkAccessContext,
  assertCanListChallengeWorkSessions,
} from "../../../services/work-session-access";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteChallengeParamsSchema = z.object({
  id: z.string().min(1),
});

// ==================== ROUTE ====================

export async function deleteChallengeRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteChallengeParamsSchema>;
  }>(
    "/:id",
    {
      schema: {
        tags: ["challenges"],
        summary: "Delete challenge",
        description: "Soft delete a challenge",
        params: DeleteChallengeParamsSchema,
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

      const { id } = request.params;

      const ctx = await loadChallengeWorkAccessContext(id);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Challenge not found" });
      const access = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      await db
        .update(challenge)
        .set({ deletedAt: new Date() })
        .where(eq(challenge.id, id));

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
