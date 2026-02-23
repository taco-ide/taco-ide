import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200 } from "../../_responses/types";
import { db } from "@repo/infra/db";
import * as schema from "@repo/infra/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const StartWorkSessionBodySchema = z.object({
  challengeId: z.string(),
  classroomId: z.string().optional(),
});

const StartWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    workSessionId: z.string(),
  }),
});

const ErrorResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function startWorkSessionRoute(app: FastifyTypedInstance) {
  app.post(
    "/start",
    {
      schema: {
        tags: ["work-sessions"],
        description: "Start or retrieve an active work session for a challenge",
        body: StartWorkSessionBodySchema,
        response: {
          200: StartWorkSessionResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { challengeId, classroomId } = request.body;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      try {
        // 1. Find the default teaching assistant for this challenge
        const defaultTa = await db.query.challengeTeachingAssistant.findFirst({
          where: and(
            eq(schema.challengeTeachingAssistant.challengeId, challengeId),
            eq(schema.challengeTeachingAssistant.isDefault, true),
          ),
        });

        if (!defaultTa) {
          return reply.status(404).send({
            success: false,
            message: "No default teaching assistant found for this challenge",
          });
        }

        // 2. Check for an existing active session (not ended)
        const existingSession = await db.query.workSession.findFirst({
          where: and(
            eq(schema.workSession.userId, userId),
            eq(schema.workSession.challengeId, challengeId),
            isNull(schema.workSession.endedAt),
          ),
        });

        if (existingSession) {
          return reply.send({
            success: true,
            data: { workSessionId: existingSession.id },
          });
        }

        // 3. Create a new work session
        const newId = crypto.randomUUID();
        await db.insert(schema.workSession).values({
          id: newId,
          userId,
          challengeId,
          classroomId: classroomId ?? null,
          teachingAssistantId: defaultTa.teachingAssistantId,
        });

        return reply.send({
          success: true,
          data: { workSessionId: newId },
        });
      } catch (error) {
        request.log.error({ err: error, userId, challengeId }, "Failed to start work session");
        return reply.status(500).send({
          success: false,
          message: "Failed to start work session. Please try again.",
        });
      }
    }
  );
}
