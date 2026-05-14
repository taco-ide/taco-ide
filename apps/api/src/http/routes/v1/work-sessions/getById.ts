import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const WorkSessionParamsSchema = z.object({
  id: z.string().min(1),
});

const InteractionSchema = z.object({
  id: z.string(),
  interactionType: z.string(),
  userPrompt: z.string(),
  modelResponse: z.string(),
  code: z.string().nullable(),
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  createdAt: z.string(),
});

const GetWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    challengeId: z.string(),
    teachingAssistantId: z.string(),
    classroomId: z.string().nullable(),
    createdAt: z.string(),
    lastMessageAt: z.string().nullable(),
    endedAt: z.string().nullable(),
    interactions: z.array(InteractionSchema),
  }),
});

// ==================== ROUTE ====================

export async function getWorkSessionByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof WorkSessionParamsSchema>;
  }>(
    "/:id",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Get work session by ID with interactions",
        description: "Returns a work session with its full interaction history",
        params: WorkSessionParamsSchema,
        response: {
          200: GetWorkSessionResponseSchema,
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
          message: "Not authorized to access this work session",
        });
      }

      const interactions = await db
        .select()
        .from(userInteractionOnChallenge)
        .where(eq(userInteractionOnChallenge.workSessionId, id))
        .orderBy(asc(userInteractionOnChallenge.createdAt));

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
          interactions: interactions.map((i) => ({
            id: i.id,
            interactionType: i.interactionType,
            userPrompt: i.userPrompt,
            modelResponse: i.modelResponse,
            code: i.code,
            stdin: i.stdin,
            stdout: i.stdout,
            createdAt: i.createdAt.toISOString(),
          })),
        },
      });
    }
  );
}
