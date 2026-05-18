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
import {
  workSession,
  teachingAssistantEvaluation,
} from "@repo/infra/db/schema";
import {
  assertCanParticipateInChallengeWorkSession,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";

const WorkSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

const SubmitWorkSessionBodySchema = z.object({
  taGrade: z.number().int().min(1).max(5).optional(),
});

const SubmitWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    endedAt: z.string(),
  }),
});

export async function submitWorkSessionRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof WorkSessionParamsSchema>;
    Body: z.infer<typeof SubmitWorkSessionBodySchema>;
  }>(
    "/:id/submit",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Submit work session",
        description:
          "Marks the work session as submitted (sets endedAt). Optionally records an anonymous 1–5 rating for the teaching assistant — only the TA id, grade and timestamp are stored. Only the session owner can submit.",
        params: WorkSessionParamsSchema,
        body: SubmitWorkSessionBodySchema,
        response: {
          200: SubmitWorkSessionResponseSchema,
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

      if (session.userId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "Not authorized to submit this work session",
        });
      }

      const ctx = await loadChallengeWorkAccessContext(session.challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const access = await assertCanParticipateInChallengeWorkSession(usr, ctx);
      if (!access.ok) {
        return reply.status(access.status).send({
          success: false as const,
          message: access.message,
        });
      }

      if (session.endedAt !== null) {
        return reply.status(400).send({
          success: false as const,
          message: "Work session is already submitted",
        });
      }

      const now = new Date();
      const [updated] = await db
        .update(workSession)
        .set({ endedAt: now, updatedAt: now })
        .where(and(eq(workSession.id, id), isNull(workSession.endedAt)))
        .returning();

      if (!updated) {
        return reply.status(400).send({
          success: false as const,
          message: "Could not submit work session",
        });
      }

      const taGrade = request.body?.taGrade;
      if (typeof taGrade === "number") {
        // Best-effort: a failed evaluation insert must not 500 a successful
        // submission. The rating is anonymous and sparse; losing one is
        // acceptable, blocking the student is not.
        try {
          await db.insert(teachingAssistantEvaluation).values({
            id: crypto.randomUUID(),
            teachingAssistantId: session.teachingAssistantId,
            grade: taGrade,
          });
        } catch (err) {
          request.log.error(
            { err, teachingAssistantId: session.teachingAssistantId },
            "Failed to persist teaching assistant evaluation"
          );
        }
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          endedAt: updated.endedAt!.toISOString(),
        },
      });
    }
  );
}
