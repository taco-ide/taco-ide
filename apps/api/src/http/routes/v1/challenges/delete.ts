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
import { challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteChallengeParamsSchema = z.object({
  id: z.string().uuid(),
});

// ==================== ROUTE ====================

export async function deleteChallengeRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteChallengeParamsSchema>;
  }>(
    "/:id",
    {
      preHandler: [requirePermission("challenge", "delete")],
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

      const existing = await db
        .select({
          id: challenge.id,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, id), isNull(challenge.deletedAt)))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      if (
        usr.role === "teacher" &&
        existing[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only delete your own challenges",
        });
      }

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
