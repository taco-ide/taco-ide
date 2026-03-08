import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { challenge, classroom } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const UpdateChallengeParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateChallengeBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  classroomId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  supportMaterials: z.unknown().optional(),
  possibleSolutions: z.unknown().optional(),
});

const ChallengeUpdatedSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  classroomId: z.string().nullable(),
  updatedAt: z.string(),
});

const UpdateChallengeResponseSchema = ResponseSchema200.extend({
  data: ChallengeUpdatedSchema,
});

// ==================== ROUTE ====================

export async function updateChallengeRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof UpdateChallengeParamsSchema>;
    Body: z.infer<typeof UpdateChallengeBodySchema>;
  }>(
    "/:id",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges"],
        summary: "Update challenge",
        description: "Update an existing challenge",
        params: UpdateChallengeParamsSchema,
        body: UpdateChallengeBodySchema,
        response: {
          200: UpdateChallengeResponseSchema,
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
          message: "You can only update your own challenges",
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

      if (classroomId !== undefined && classroomId !== null) {
        const cl = await db
          .select({ id: classroom.id, organizationId: classroom.organizationId })
          .from(classroom)
          .where(and(eq(classroom.id, classroomId), isNull(classroom.deletedAt)))
          .limit(1);

        if (!cl[0]) {
          return reply.status(404).send({
            success: false as const,
            message: "Classroom not found",
          });
        }

        if (cl[0].organizationId !== usr.activeOrganizationId) {
          return reply.status(403).send({
            success: false as const,
            message: "Classroom does not belong to your active organization",
          });
        }
      }

      const updateSet: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (title !== undefined) updateSet.title = title;
      if (description !== undefined) updateSet.description = description;
      if (difficulty !== undefined) updateSet.difficulty = difficulty;
      if (classroomId !== undefined) updateSet.classroomId = classroomId;
      if (tags !== undefined) updateSet.tags = tags;
      if (supportMaterials !== undefined) updateSet.supportMaterials = supportMaterials;
      if (possibleSolutions !== undefined) updateSet.possibleSolutions = possibleSolutions;

      const [updated] = await db
        .update(challenge)
        .set(updateSet as typeof challenge.$inferInsert)
        .where(eq(challenge.id, id))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update challenge",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          difficulty: updated.difficulty,
          tags: updated.tags ?? null,
          classroomId: updated.classroomId,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }
  );
}
