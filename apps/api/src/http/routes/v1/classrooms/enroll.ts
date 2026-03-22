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
import { classroom, userClassroom, member } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ClassroomParamsSchema = z.object({
  id: z.string().uuid(),
});

const EnrollBodySchema = z.object({
  userId: z.string().uuid().optional(),
});

// ==================== ROUTE ====================

export async function enrollClassroomRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ClassroomParamsSchema>;
    Body: z.infer<typeof EnrollBodySchema>;
  }>(
    "/enroll",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Enroll in classroom",
        description:
          "Enroll a user in a classroom. If userId is omitted, enrolls the current user (self-enroll). Teachers+ can enroll other users in their org.",
        params: ClassroomParamsSchema,
        body: EnrollBodySchema.optional(),
        response: {
          200: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
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

      const { id: classroomId } = request.params;
      const targetUserId = request.body?.userId ?? usr.id;

      const cls = await db
        .select({
          id: classroom.id,
          organizationId: classroom.organizationId,
          teacherUserId: classroom.teacherUserId,
        })
        .from(classroom)
        .where(and(eq(classroom.id, classroomId), isNull(classroom.deletedAt)))
        .limit(1);

      if (!cls[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Classroom not found",
        });
      }

      const isSelfEnroll = targetUserId === usr.id;

      if (!isSelfEnroll) {
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
            message: "You must be a member of the organization to enroll others",
          });
        }

        const isCoordinatorPlus = ["coordinator", "admin"].includes(membership[0].role);
        const isLeadTeacher = cls[0].teacherUserId === usr.id;
        if (!isCoordinatorPlus && !isLeadTeacher) {
          return reply.status(403).send({
            success: false as const,
            message: "Only coordinator or the assigned teacher can enroll other users",
          });
        }

        const targetMember = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.userId, targetUserId),
              eq(member.organizationId, cls[0].organizationId)
            )
          )
          .limit(1);
        if (!targetMember[0]) {
          return reply.status(400).send({
            success: false as const,
            message: "Target user must be a member of the classroom's organization",
          });
        }
      } else {
        const userMember = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.userId, usr.id),
              eq(member.organizationId, cls[0].organizationId)
            )
          )
          .limit(1);

        if (!userMember[0]) {
          return reply.status(403).send({
            success: false as const,
            message: "You must be a member of the organization to enroll in this classroom",
          });
        }
      }

      const existing = await db
        .select()
        .from(userClassroom)
        .where(
          and(
            eq(userClassroom.userId, targetUserId),
            eq(userClassroom.classroomId, classroomId)
          )
        )
        .limit(1);

      if (existing[0]) {
        if (!existing[0].deletedAt) {
          return reply.status(400).send({
            success: false as const,
            message: "User is already enrolled in this classroom",
          });
        }
        await db
          .update(userClassroom)
          .set({ deletedAt: null })
          .where(
            and(
              eq(userClassroom.userId, targetUserId),
              eq(userClassroom.classroomId, classroomId)
            )
          );
      } else {
        await db.insert(userClassroom).values({
          userId: targetUserId,
          classroomId,
        });
      }

      return reply.status(200).send({
        success: true as const,
        message: "Enrolled successfully",
      });
    }
  );
}
