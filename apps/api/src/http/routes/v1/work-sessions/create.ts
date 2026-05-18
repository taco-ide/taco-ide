import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  challengeTeachingAssistant,
  teachingAssistant,
} from "@repo/infra/db/schema";
import {
  assertCanParticipateInChallengeWorkSession,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";

// ==================== SCHEMAS ====================

const CreateWorkSessionBodySchema = z
  .object({
    challengeId: z.string().uuid(),
    /** Se omitido, o servidor usa o TA predefinido ligado ao desafio em `challenge_teaching_assistant`. */
    teachingAssistantId: z.string().uuid().optional(),
  })
  .strict();

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
        description:
          "Start a new work session on a challenge. Optionally pass teachingAssistantId; if omitted, the server picks the default TA linked to the challenge, or an active TA from the classroom/user organization when the challenge has no M2M row.",
        body: CreateWorkSessionBodySchema,
        response: {
          201: CreateWorkSessionResponseSchema,
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

      const { challengeId, teachingAssistantId: bodyTeachingAssistantId } =
        request.body;

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      let teachingAssistantId: string;

      if (bodyTeachingAssistantId) {
        const cta = await db
          .select()
          .from(challengeTeachingAssistant)
          .where(
            and(
              eq(challengeTeachingAssistant.challengeId, challengeId),
              eq(
                challengeTeachingAssistant.teachingAssistantId,
                bodyTeachingAssistantId
              )
            )
          )
          .limit(1);

        if (!cta[0]) {
          return reply.status(400).send({
            success: false as const,
            message: "Teaching assistant not assigned to this challenge",
          });
        }
        teachingAssistantId = bodyTeachingAssistantId;
      } else {
        const [defaultRow] = await db
          .select({
            teachingAssistantId: challengeTeachingAssistant.teachingAssistantId,
          })
          .from(challengeTeachingAssistant)
          .where(eq(challengeTeachingAssistant.challengeId, challengeId))
          .orderBy(desc(challengeTeachingAssistant.isDefault))
          .limit(1);

        if (defaultRow) {
          teachingAssistantId = defaultRow.teachingAssistantId;
        } else {
          let organizationId: string | null = ctx.organizationId;
          if (!organizationId && usr.activeOrganizationId) {
            organizationId = usr.activeOrganizationId;
          }
          if (!organizationId) {
            return reply.status(400).send({
              success: false as const,
              message: "Challenge has no teaching assistant configured",
            });
          }
          const [orgTa] = await db
            .select({ id: teachingAssistant.id })
            .from(teachingAssistant)
            .where(
              and(
                eq(teachingAssistant.createdByOrganizationId, organizationId),
                eq(teachingAssistant.isActive, true)
              )
            )
            .limit(1);
          if (!orgTa) {
            return reply.status(400).send({
              success: false as const,
              message: "No active teaching assistant for this organization",
            });
          }
          teachingAssistantId = orgTa.id;
        }
      }

      const access = await assertCanParticipateInChallengeWorkSession(usr, ctx);
      if (!access.ok) {
        return reply.status(access.status).send({
          success: false as const,
          message: access.message,
        });
      }

      const insertResult = await db
        .insert(workSession)
        .values({
          id: randomUUID(),
          userId: usr.id,
          challengeId,
          teachingAssistantId,
          classroomId: ctx.classroomId,
        })
        .onConflictDoNothing({
          target: [workSession.userId, workSession.challengeId],
        })
        .returning();

      let session = insertResult[0];
      if (!session) {
        const [existing] = await db
          .select()
          .from(workSession)
          .where(
            and(
              eq(workSession.userId, usr.id),
              eq(workSession.challengeId, challengeId)
            )
          )
          .limit(1);
        if (!existing) {
          return reply.status(500).send({
            success: false as const,
            message: "Failed to create work session",
          });
        }
        session = existing;
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
