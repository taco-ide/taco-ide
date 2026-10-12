import {
  loadClassroomAccessContext,
  assertCanAccessClassroom,
} from "../../../services/work-session-access";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
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
        description:
          "Soft delete a classroom. Requires coordinator or admin role.",
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

      const { id } = request.params;

      const ctx = await loadClassroomAccessContext(id);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Classroom not found" });
      const access = await assertCanAccessClassroom(usr, ctx, "coordinate");
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

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
