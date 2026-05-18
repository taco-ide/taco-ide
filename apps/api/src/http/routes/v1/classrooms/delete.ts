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

// ==================== ROUTE ====================

export async function deleteClassroomRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof ClassroomParamsSchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Delete classroom (soft delete)",
        description: "Soft delete a classroom. Requires coordinator or admin role.",
        params: ClassroomParamsSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
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
      if (!roleHasPermission(role, "classroom", "delete")) {
        return reply.status(403).send({
          success: false as const,
          message: "Insufficient permissions to delete classrooms",
        });
      }

      const { id } = request.params;

      const existing = await db
        .select({ id: classroom.id, organizationId: classroom.organizationId })
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
          message: "You must be a member of the classroom's organization to delete it",
        });
      }

      const coordinatorRoles = ["coordinator", "admin"];
      if (!coordinatorRoles.includes(membership[0].role)) {
        return reply.status(403).send({
          success: false as const,
          message: "Only coordinators and admins can delete classrooms",
        });
      }

      await db
        .update(classroom)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(classroom.id, id));

      return reply.status(200).send({
        success: true as const,
        message: "Classroom deleted successfully",
      });
    }
  );
}
