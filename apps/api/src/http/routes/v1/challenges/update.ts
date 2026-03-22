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
import { challenge, classroom, member } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ChallengeParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateChallengeBodySchema = z.object({
  classroomId: z.string().uuid().nullable(),
});

const UpdateChallengeResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    classroomId: z.string().nullable(),
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
      schema: {
        tags: ["challenges"],
        summary: "Update challenge (assign to classroom)",
        description:
          "Assign a challenge to a classroom or remove assignment. Teacher: only classrooms they lead. Coordinator: any classroom in org.",
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
      const { classroomId } = request.body;

      const existing = await db
        .select({
          id: challenge.id,
          classroomId: challenge.classroomId,
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

      if (classroomId) {
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
      } else {
        if (!existing[0].classroomId) {
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
          .where(eq(classroom.id, existing[0].classroomId!))
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

      const [updated] = await db
        .update(challenge)
        .set({
          classroomId,
          updatedAt: new Date(),
        })
        .where(eq(challenge.id, challengeId))
        .returning({ id: challenge.id, classroomId: challenge.classroomId });

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
          classroomId: updated.classroomId ?? null,
          message: classroomId
            ? "Challenge assigned to classroom"
            : "Challenge unassigned from classroom",
        },
      });
    }
  );
}
