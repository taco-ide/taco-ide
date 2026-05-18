import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  classroom,
  organization,
  user,
  userClassroom,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ClassroomParamsSchema = z.object({
  id: z.string().min(1),
});

const EnrollmentItemSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  enrolledAt: z.string(),
});

const GetClassroomResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    organizationId: z.string(),
    organizationName: z.string().nullable(),
    teacherUserId: z.string().nullable(),
    teacherName: z.string().nullable(),
    enrollments: z.array(EnrollmentItemSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function getClassroomByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ClassroomParamsSchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Get classroom by ID",
        description: "Returns a single classroom with organization info",
        params: ClassroomParamsSchema,
        response: {
          200: GetClassroomResponseSchema,
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

      const { id } = request.params;

      const result = await db
        .select({
          id: classroom.id,
          title: classroom.title,
          description: classroom.description,
          organizationId: classroom.organizationId,
          teacherUserId: classroom.teacherUserId,
          createdAt: classroom.createdAt,
          updatedAt: classroom.updatedAt,
          organizationName: organization.name,
          teacherName: user.name,
        })
        .from(classroom)
        .leftJoin(organization, eq(classroom.organizationId, organization.id))
        .leftJoin(user, eq(classroom.teacherUserId, user.id))
        .where(and(eq(classroom.id, id), isNull(classroom.deletedAt)))
        .limit(1);

      const c = result[0];
      if (!c) {
        return reply.status(404).send({
          success: false as const,
          message: "Classroom not found",
        });
      }

      const enrollments = await db
        .select({
          userId: userClassroom.userId,
          name: user.name,
          email: user.email,
          enrolledAt: userClassroom.enrolledAt,
        })
        .from(userClassroom)
        .innerJoin(user, eq(userClassroom.userId, user.id))
        .where(
          and(
            eq(userClassroom.classroomId, id),
            isNull(userClassroom.deletedAt)
          )
        );

      return reply.status(200).send({
        success: true as const,
        data: {
          id: c.id,
          title: c.title,
          description: c.description,
          organizationId: c.organizationId,
          organizationName: c.organizationName ?? null,
          teacherUserId: c.teacherUserId ?? null,
          teacherName: c.teacherName ?? null,
          enrollments: enrollments.map((e) => ({
            userId: e.userId,
            name: e.name ?? "",
            email: e.email,
            enrolledAt: e.enrolledAt.toISOString(),
          })),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        },
      });
    }
  );
}
