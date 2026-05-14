import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { classroom, member } from "@repo/infra/db/schema";
import { roleHasPermission } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const ClassroomParamsSchema = z.object({
  id: z.string().min(1),
});

const UpdateClassroomBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  teacherUserId: z.string().min(1).nullable().optional(),
});

const ClassroomSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  teacherUserId: z.string().nullable(),
  updatedAt: z.string(),
});

const UpdateClassroomResponseSchema = ResponseSchema200.extend({
  data: ClassroomSchema,
});

// ==================== ROUTE ====================

export async function updateClassroomRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof ClassroomParamsSchema>;
    Body: z.infer<typeof UpdateClassroomBodySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Update classroom",
        description:
          "Update a classroom. Coordinator+ can change teacherUserId, title, description. Professor responsável can change title and description only.",
        params: ClassroomParamsSchema,
        body: UpdateClassroomBodySchema,
        response: {
          200: UpdateClassroomResponseSchema,
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

      const role = usr.role ?? "student";
      if (!roleHasPermission(role, "classroom", "update")) {
        return reply.status(403).send({
          success: false as const,
          message: "Insufficient permissions to update classrooms",
        });
      }

      const { id } = request.params;
      const { title, description, teacherUserId } = request.body;

      const existing = await db
        .select({
          id: classroom.id,
          organizationId: classroom.organizationId,
          teacherUserId: classroom.teacherUserId,
        })
        .from(classroom)
        .where(and(eq(classroom.id, id), isNull(classroom.deletedAt)))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Classroom not found",
        });
      }

      const membership = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, usr.id),
            eq(member.organizationId, existing[0].organizationId)
          )
        )
        .limit(1);

      if (!membership[0]) {
        return reply.status(403).send({
          success: false as const,
          message: "You must be a member of the classroom's organization to update it",
        });
      }

      const teacherRoles = ["teacher", "coordinator", "admin"];
      if (!teacherRoles.includes(membership[0].role)) {
        return reply.status(403).send({
          success: false as const,
          message: "Only teachers and above can update classrooms",
        });
      }

      const isCoordinatorPlus = ["coordinator", "admin"].includes(membership[0].role);
      const isLeadTeacher = existing[0].teacherUserId === usr.id;

      if (teacherUserId !== undefined) {
        if (!isCoordinatorPlus) {
          return reply.status(403).send({
            success: false as const,
            message: "Only coordinator+ can change the assigned teacher",
          });
        }
      }

      if (!isCoordinatorPlus && !isLeadTeacher) {
        return reply.status(403).send({
          success: false as const,
          message: "Only coordinator+ or the assigned teacher can update this classroom",
        });
      }

      const updateData: {
        title?: string;
        description?: string | null;
        teacherUserId?: string | null;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (teacherUserId !== undefined && isCoordinatorPlus)
        updateData.teacherUserId = teacherUserId;

      const [updated] = await db
        .update(classroom)
        .set(updateData)
        .where(eq(classroom.id, id))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update classroom",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          organizationId: updated.organizationId,
          teacherUserId: updated.teacherUserId ?? null,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }
  );
}
