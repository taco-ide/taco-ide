import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  teachingAssistant,
  challengeTeachingAssistant,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const CreateChallengeBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    classroomId: z.string().min(1),
    tags: z.array(z.string()).optional(),
    supportMaterials: z.unknown().optional(),
    possibleSolutions: z.unknown().optional(),
  })
  .strict();

const ChallengeCreatedSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  classroomId: z.string().nullable(),
  createdAt: z.string(),
});

const CreateChallengeResponseSchema = ResponseSchema201.extend({
  data: ChallengeCreatedSchema,
});

// ==================== ROUTE ====================

export async function createChallengeRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateChallengeBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "create")],
      schema: {
        tags: ["challenges"],
        summary: "Create challenge",
        description: "Create a new challenge",
        body: CreateChallengeBodySchema,
        response: {
          201: CreateChallengeResponseSchema,
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

      const {
        title,
        description,
        difficulty,
        classroomId,
        tags,
        supportMaterials,
        possibleSolutions,
      } = request.body;

      const [cl] = await db
        .select({ id: classroom.id, organizationId: classroom.organizationId })
        .from(classroom)
        .where(and(eq(classroom.id, classroomId), isNull(classroom.deletedAt)))
        .limit(1);

      if (!cl) {
        return reply.status(404).send({
          success: false as const,
          message: "Classroom not found",
        });
      }

      const organizationId = cl.organizationId;

      if (organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Classroom does not belong to your active organization",
        });
      }

      const id = randomUUID();

      const [created] = await db
        .insert(challenge)
        .values({
          id,
          title,
          description: description ?? null,
          difficulty,
          classroomId,
          tags: tags ?? null,
          supportMaterials: supportMaterials ?? null,
          possibleSolutions: possibleSolutions ?? null,
          createdByUserId: usr.id,
        })
        .returning();

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create challenge",
        });
      }

      // Auto-link default Teaching Assistant from the same classroom
      const [classroomTA] = await db
        .select({ id: teachingAssistant.id })
        .from(teachingAssistant)
        .where(
          and(
            eq(teachingAssistant.createdByOrganizationId, organizationId),
            eq(teachingAssistant.isActive, true)
          )
        )
        .limit(1);

      if (classroomTA) {
        await db.insert(challengeTeachingAssistant).values({
          challengeId: created.id,
          teachingAssistantId: classroomTA.id,
          isDefault: true,
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          title: created.title,
          description: created.description,
          difficulty: created.difficulty,
          tags: created.tags ?? null,
          classroomId: created.classroomId,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
