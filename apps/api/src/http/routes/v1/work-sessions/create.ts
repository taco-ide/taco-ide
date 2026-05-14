import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  challenge,
  challengeTeachingAssistant,
  classroom,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const CreateWorkSessionBodySchema = z.object({
  challengeId: z.string().min(1),
  teachingAssistantId: z.string().min(1),
});

const WorkSessionSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  teachingAssistantId: z.string(),
  classroomId: z.string().nullable(),
  createdAt: z.string(),
});

const CreateWorkSessionResponseSchema = ResponseSchema201.extend({
  data: WorkSessionSchema,
});

// ==================== ROUTE ====================

export async function createWorkSessionRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateWorkSessionBodySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Create work session",
        description: "Start a new work session on a challenge with a teaching assistant",
        body: CreateWorkSessionBodySchema,
        response: {
          201: CreateWorkSessionResponseSchema,
          400: ResponseSchema400,
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

      const { challengeId, teachingAssistantId } = request.body;

      const ch = await db
        .select({ id: challenge.id, classroomId: challenge.classroomId })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const cta = await db
        .select()
        .from(challengeTeachingAssistant)
        .where(
          and(
            eq(challengeTeachingAssistant.challengeId, challengeId),
            eq(challengeTeachingAssistant.teachingAssistantId, teachingAssistantId)
          )
        )
        .limit(1);

      if (!cta[0]) {
        return reply.status(400).send({
          success: false as const,
          message: "Teaching assistant not assigned to this challenge",
        });
      }

      const [session] = await db
        .insert(workSession)
        .values({
          id: randomUUID(),
          userId: usr.id,
          challengeId,
          teachingAssistantId,
          classroomId: ch[0].classroomId,
        })
        .returning();

      if (!session) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create work session",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: session.id,
          challengeId: session.challengeId,
          teachingAssistantId: session.teachingAssistantId,
          classroomId: session.classroomId,
          createdAt: session.createdAt.toISOString(),
        },
      });
    }
  );
}
