import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema401 } from "../../_responses/types";

// ==================== SCHEMAS ====================

const TeacherHistoryResponseSchema = ResponseSchema200.extend({
  data: z.array(z.never()),
});

// ==================== ROUTE ====================

export async function teacherHistoryRoute(app: FastifyTypedInstance) {
  app.get(
    "/teacher/history/:classroomId",
    {
      schema: {
        tags: ["chat"],
        summary: "Get teacher chat history for a classroom (placeholder)",
        description:
          "Placeholder endpoint. Teacher chat sessions are ephemeral for MVP " +
          "and not persisted to the database.",
        params: z.object({
          classroomId: z.string(),
        }),
        response: {
          200: TeacherHistoryResponseSchema,
          401: ResponseSchema401,
        },
      },
    },
    async (request, reply) => {
      const { user } = request;
      if (!user) {
        return reply
          .status(401)
          .send({ success: false as const, message: "Not authenticated" });
      }

      return reply.status(200).send({
        success: true as const,
        data: [],
      });
    },
  );
}
