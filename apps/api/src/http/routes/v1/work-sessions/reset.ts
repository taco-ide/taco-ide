import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { workSession, challengeSolution } from "@repo/infra/db/schema";
import {
  assertStaffCanAccessChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";

const WorkSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

const ResetWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    archived: z.literal(true),
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
          "Archives the work session (its interactions are kept for research data) and clears the student's solution for this challenge; the student's next action starts a new session. Teacher, coordinator, or admin only.",
        params: WorkSessionParamsSchema,
        response: {
          200: ResetWorkSessionResponseSchema,
          400: ResponseSchema400,
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

      const ctx = await loadChallengeWorkAccessContext(session.challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const access = await assertStaffCanAccessChallengeWorkSessions(
        usr,
        ctx,
        "mutate"
      );
      if (!access.ok) {
        return reply.status(access.status).send({
          success: false as const,
          message: access.message,
        });
      }

      if (session.archivedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "Work session was already reset",
        });
      }

      const ownerUserId = session.userId;
      const challengeId = session.challengeId;

      const archived = await db.transaction(async (tx) => {
        const now = new Date();
        const rows = await tx
          .update(workSession)
          .set({ archivedAt: now, updatedAt: now })
          .where(and(eq(workSession.id, id), isNull(workSession.archivedAt)))
          .returning({ id: workSession.id });
        // A concurrent reset archived it first; the solution may already
        // belong to the student's new attempt, so leave it alone.
        if (rows.length === 0) return false;

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
        return true;
      });

      if (!archived) {
        return reply.status(400).send({
          success: false as const,
          message: "Work session was already reset",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: { archived: true as const },
      });
    }
  );
}
