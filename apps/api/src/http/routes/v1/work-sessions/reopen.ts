import { z } from "zod";
import { eq, and, isNotNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { workSession } from "@repo/infra/db/schema";
import { hasMinimumRole } from "@repo/infra/auth";

const WorkSessionParamsSchema = z.object({
  id: z.string().uuid(),
});

const ReopenWorkSessionResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    endedAt: z.null(),
  }),
});

export async function reopenWorkSessionRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof WorkSessionParamsSchema>;
  }>(
    "/:id/reopen",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Reopen work session",
        description:
          "Clears endedAt on a submitted work session. Teacher, coordinator, or admin only.",
        params: WorkSessionParamsSchema,
        response: {
          200: ReopenWorkSessionResponseSchema,
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

      if (!usr.role || !hasMinimumRole(usr.role, "teacher")) {
        return reply.status(403).send({
          success: false as const,
          message: "Only teachers and above can reopen a work session",
        });
      }

      const { id } = request.params;

      const [session] = await db
        .select()
        .from(workSession)
        .where(eq(workSession.id, id))
        .limit(1);

      if (!session) {
        return reply.status(404).send({
          success: false as const,
          message: "Work session not found",
        });
      }

      if (session.endedAt === null) {
        return reply.status(400).send({
          success: false as const,
          message: "Work session is not submitted",
        });
      }

      const now = new Date();
      const [updated] = await db
        .update(workSession)
        .set({ endedAt: null, updatedAt: now })
        .where(and(eq(workSession.id, id), isNotNull(workSession.endedAt)))
        .returning();

      if (!updated) {
        return reply.status(400).send({
          success: false as const,
          message: "Could not reopen work session",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          endedAt: null,
        },
      });
    }
  );
}
