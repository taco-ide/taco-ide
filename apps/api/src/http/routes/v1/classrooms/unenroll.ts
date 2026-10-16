import {
  loadClassroomAccessContext,
  assertCanAccessClassroom,
  getMembershipRole,
} from "../../../services/work-session-access";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { userClassroom } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ClassroomParamsSchema = z.object({
  id: z.string().min(1),
});

const UnenrollBodySchema = z
  .object({
    userId: z.string().min(1).optional(),
  })
  .strict();

// ==================== ROUTE ====================

export async function unenrollClassroomRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ClassroomParamsSchema>;
    Body: z.infer<typeof UnenrollBodySchema>;
  }>(
    "/unenroll",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Unenroll from classroom",
        description:
          "Remove a user from a classroom. If userId is omitted, unenrolls the current user. Teachers+ can unenroll others.",
        params: ClassroomParamsSchema,
        body: UnenrollBodySchema.optional(),
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

      const ctx = await loadClassroomAccessContext(classroomId);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Classroom not found" });
      if (targetUserId !== usr.id) {
        const access = await assertCanAccessClassroom(usr, ctx, "manage");
        if (!access.ok)
          return reply
            .status(access.status)
            .send({ success: false as const, message: access.message });
      } else if (!(await getMembershipRole(usr.id, ctx.organizationId))) {
        return reply.status(403).send({
          success: false as const,
          message: "You must be a member of this organization",
        });
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

      if (!existing[0] || existing[0].deletedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "User is not enrolled in this classroom",
        });
      }

      await db
        .update(userClassroom)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(userClassroom.userId, targetUserId),
            eq(userClassroom.classroomId, classroomId)
          )
        );

      return reply.status(200).send({
        success: true as const,
        message: "Unenrolled successfully",
      });
    }
  );
}
