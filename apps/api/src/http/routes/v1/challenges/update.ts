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
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { challenge, classroom, member } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ChallengeParamsSchema = z.object({
  id: z.string().min(1),
});

const UpdateChallengeBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    possibleSolutions: z.string().nullable().optional(),
    classroomId: z.string().min(1).nullable().optional(),
  })
  .strict();

const UpdateChallengeResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    classroomId: z.string().nullable(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    difficulty: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    possibleSolutions: z.string().nullable(),
    message: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function updateChallengeRoute(app: FastifyTypedInstance) {
  app.patch<{
    Params: z.infer<typeof ChallengeParamsSchema>;
    Body: z.infer<typeof UpdateChallengeBodySchema>;
  }>(
    "/:id",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges"],
        summary: "Update challenge",
        description:
          "Update challenge content (title, description, difficulty, tags, possibleSolutions) and/or assign to a classroom. Teacher: only own challenges. Coordinator/admin: any challenge in their org. Classroom reassignment additionally requires coordinator+ or being the classroom lead teacher.",
        params: ChallengeParamsSchema,
        body: UpdateChallengeBodySchema,
        response: {
          200: UpdateChallengeResponseSchema,
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

      const { id: challengeId } = request.params;
      const body = request.body;
      const wantsClassroomChange = Object.prototype.hasOwnProperty.call(
        body,
        "classroomId"
      );
      const { classroomId } = body;

      const existing = await db
        .select({
          id: challenge.id,
          classroomId: challenge.classroomId,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      // Ownership check for content edits: teachers may only edit their own
      // challenges; coordinators/admins may edit any in their org.
      const isContentEdit =
        body.title !== undefined ||
        body.description !== undefined ||
        body.difficulty !== undefined ||
        body.tags !== undefined ||
        body.possibleSolutions !== undefined;

      if (
        isContentEdit &&
        usr.role === "teacher" &&
        existing[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only edit your own challenges",
        });
      }

      if (wantsClassroomChange && classroomId) {
        const cls = await db
          .select({
            id: classroom.id,
            organizationId: classroom.organizationId,
            teacherUserId: classroom.teacherUserId,
          })
          .from(classroom)
          .where(
            and(eq(classroom.id, classroomId), isNull(classroom.deletedAt))
          )
          .limit(1);

        if (!cls[0]) {
          return reply.status(404).send({
            success: false as const,
            message: "Classroom not found",
          });
        }

        if (existing[0].classroomId) {
          return reply.status(400).send({
            success: false as const,
            message:
              "Challenge is already assigned to a classroom. Remove assignment first.",
          });
        }

        const membership = await db
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.userId, usr.id),
              eq(member.organizationId, cls[0].organizationId)
            )
          )
          .limit(1);

        if (!membership[0]) {
          return reply.status(403).send({
            success: false as const,
            message: "You must be a member of the classroom's organization",
          });
        }

        const isCoordinatorPlus = ["coordinator", "admin"].includes(
          membership[0].role
        );
        const isLeadTeacher = cls[0].teacherUserId === usr.id;
        if (!isCoordinatorPlus && !isLeadTeacher) {
          return reply.status(403).send({
            success: false as const,
            message:
              "Only coordinator or the assigned teacher can assign challenges to this classroom",
          });
        }
      } else if (wantsClassroomChange && classroomId === null) {
        const currentClassroomId = existing[0].classroomId;
        if (!currentClassroomId) {
          return reply.status(400).send({
            success: false as const,
            message: "Challenge is not assigned to any classroom",
          });
        }

        const cls = await db
          .select({
            organizationId: classroom.organizationId,
            teacherUserId: classroom.teacherUserId,
          })
          .from(classroom)
          .where(eq(classroom.id, currentClassroomId))
          .limit(1);

        if (cls[0]) {
          const membership = await db
            .select({ role: member.role })
            .from(member)
            .where(
              and(
                eq(member.userId, usr.id),
                eq(member.organizationId, cls[0].organizationId)
              )
            )
            .limit(1);

          if (membership[0]) {
            const isCoordinatorPlus = ["coordinator", "admin"].includes(
              membership[0].role
            );
            const isLeadTeacher = cls[0].teacherUserId === usr.id;
            if (!isCoordinatorPlus && !isLeadTeacher) {
              return reply.status(403).send({
                success: false as const,
                message:
                  "Only coordinator or the assigned teacher can remove challenges from this classroom",
              });
            }
          }
        }
      }

      const setValues: Partial<typeof challenge.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (wantsClassroomChange) setValues.classroomId = classroomId;
      if (body.title !== undefined) setValues.title = body.title;
      if (body.description !== undefined) setValues.description = body.description;
      if (body.difficulty !== undefined) setValues.difficulty = body.difficulty;
      if (body.tags !== undefined) setValues.tags = body.tags;
      if (body.possibleSolutions !== undefined) {
        setValues.possibleSolutions = body.possibleSolutions;
      }

      const [updated] = await db
        .update(challenge)
        .set(setValues)
        .where(eq(challenge.id, challengeId))
        .returning({
          id: challenge.id,
          classroomId: challenge.classroomId,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          tags: challenge.tags,
          possibleSolutions: challenge.possibleSolutions,
        });

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update challenge",
        });
      }

      const possibleSolutionsOut =
        updated.possibleSolutions === null || updated.possibleSolutions === undefined
          ? null
          : typeof updated.possibleSolutions === "string"
            ? updated.possibleSolutions
            : JSON.stringify(updated.possibleSolutions);

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          classroomId: updated.classroomId ?? null,
          title: updated.title ?? null,
          description: updated.description ?? null,
          difficulty: updated.difficulty ?? null,
          tags: (updated.tags as string[] | null) ?? null,
          possibleSolutions: possibleSolutionsOut,
          message: wantsClassroomChange
            ? classroomId
              ? "Challenge assigned to classroom"
              : "Challenge unassigned from classroom"
            : "Challenge updated",
        },
      });
    }
  );
}
