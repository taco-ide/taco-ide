import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { workSession, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const GetByChallengeQuerySchema = z
  .object({
    challengeId: z.string().min(1),
  })
  .strict();

const WorkSessionSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  teachingAssistantId: z.string(),
  classroomId: z.string().nullable(),
  createdAt: z.string(),
  lastMessageAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});

const GetWorkSessionResponseSchema = ResponseSchema200.extend({
  data: WorkSessionSchema,
});

// ==================== ROUTE ====================

export async function getWorkSessionByChallengeRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof GetByChallengeQuerySchema>;
  }>(
    "/by-challenge",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Get active work session for challenge",
        description:
          "Returns the most recent active (not ended) work session for the user on a challenge",
        querystring: GetByChallengeQuerySchema,
        response: {
          200: GetWorkSessionResponseSchema,
          401: ResponseSchema401,
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

      const { challengeId } = request.query;

      const [ch] = await db
        .select({ id: challenge.id })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const [session] = await db
        .select()
        .from(workSession)
        .where(
          and(
            eq(workSession.userId, usr.id),
            eq(workSession.challengeId, challengeId),
            isNull(workSession.endedAt)
          )
        )
        .orderBy(desc(workSession.updatedAt))
        .limit(1);

      if (!session) {
        return reply.status(404).send({
          success: false as const,
          message: "No active work session found for this challenge",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: session.id,
          challengeId: session.challengeId,
          teachingAssistantId: session.teachingAssistantId,
          classroomId: session.classroomId,
          createdAt: session.createdAt.toISOString(),
          lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
          endedAt: session.endedAt?.toISOString() ?? null,
        },
      });
    }
  );
}
