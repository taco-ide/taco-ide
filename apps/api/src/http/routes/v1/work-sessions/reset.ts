import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { workSession, challengeSolution } from "@repo/infra/db/schema";
import { hasMinimumRole } from "@repo/infra/auth";

const WorkSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

const ResetWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    deleted: z.literal(true),
  }),
});

export async function resetWorkSessionRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof WorkSessionParamsSchema>;
  }>(
    "/:id/reset",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Reset work session and solution",
        description:
          "Deletes the work session (and interactions) and clears the student's solution for this challenge. Teacher, coordinator, or admin only.",
        params: WorkSessionParamsSchema,
        response: {
          200: ResetWorkSessionResponseSchema,
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

      if (!usr.role || !hasMinimumRole(usr.role, "teacher")) {
        return reply.status(403).send({
          success: false as const,
          message: "Only teachers and above can reset a work session",
        });
      }

      const { id } = request.params;

      const [session] = await db
        .select()
        .from(workSession)
        .where(eq(workSession.id, id))
        .limit(1);

      if (!session) {
        return reply.status(404).send({
          success: false as const,
          message: "Work session not found",
        });
      }

      const ownerUserId = session.userId;
      const challengeId = session.challengeId;

      await db.transaction(async (tx) => {
        await tx.delete(workSession).where(eq(workSession.id, id));

        await tx
          .update(challengeSolution)
          .set({
            code: null,
            stdin: null,
            stdout: null,
            chatHistory: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(challengeSolution.userId, ownerUserId),
              eq(challengeSolution.challengeId, challengeId)
            )
          );
      });

      return reply.status(200).send({
        success: true as const,
        data: { deleted: true as const },
      });
    }
  );
}
