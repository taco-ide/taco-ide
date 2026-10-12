import {
  loadClassroomAccessContext,
  assertCanAccessClassroom,
  getMembershipRole,
} from "../../../services/work-session-access";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { hasMinimumRole } from "@repo/infra/auth";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { classroom } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ClassroomParamsSchema = z.object({
  id: z.string().min(1),
});

const UpdateClassroomBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    teacherUserId: z.string().min(1).nullable().optional(),
  })
  .strict();

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

      const { id } = request.params;
      const { title, description, teacherUserId } = request.body;

      const ctx = await loadClassroomAccessContext(id);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Classroom not found" });
      const access = await assertCanAccessClassroom(usr, ctx, "manage");
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });
      const coordination = await assertCanAccessClassroom(
        usr,
        ctx,
        "coordinate"
      );
      const isCoordinatorPlus = coordination.ok;
      if (teacherUserId !== undefined && !isCoordinatorPlus)
        return reply.status(403).send({
          success: false as const,
          message: "Only coordinator+ can change the assigned teacher",
        });
      if (teacherUserId) {
        const targetRole = await getMembershipRole(
          teacherUserId,
          ctx.organizationId
        );
        if (!targetRole || !hasMinimumRole(targetRole, "teacher"))
          return reply.status(403).send({
            success: false as const,
            message: "Assigned teacher must be staff of this organization",
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
