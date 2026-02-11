import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { workSession, userInteractionOnChallenge } from "@repo/infra/db/schema";
import { eq, asc } from "drizzle-orm";

// ==================== SCHEMAS ====================

const InteractionSchema = z.object({
  id: z.string(),
  userPrompt: z.string(),
  modelResponse: z.string(),
  code: z.string().nullable(),
  stdout: z.string().nullable(),
  createdAt: z.string(),
});

const HistoryResponseSchema = ResponseSchema200.extend({
  data: z.array(InteractionSchema),
});

// ==================== ROUTE ====================

export async function studentHistoryRoute(app: FastifyTypedInstance) {
  app.get(
    "/student/history/:workSessionId",
    {
      schema: {
        tags: ["chat"],
        summary: "Get student chat history for a work session",
        description:
          "Returns all user interactions (prompts and model responses) for the given work session.",
        params: z.object({
          workSessionId: z.string(),
        }),
        response: {
          200: HistoryResponseSchema,
          401: ResponseSchema401,
          404: ResponseSchema404,
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

      const { workSessionId } = request.params;

      // Verify work session ownership
      const ws = await db
        .select()
        .from(workSession)
        .where(eq(workSession.id, workSessionId))
        .limit(1);

      if (!ws[0]) {
        return reply
          .status(404)
          .send({ success: false as const, message: "Work session not found" });
      }

      if (ws[0].userId !== user.id) {
        return reply
          .status(401)
          .send({ success: false as const, message: "Not authorized" });
      }

      // Load interactions
      const interactions = await db
        .select()
        .from(userInteractionOnChallenge)
        .where(eq(userInteractionOnChallenge.workSessionId, workSessionId))
        .orderBy(asc(userInteractionOnChallenge.createdAt));

      return reply.status(200).send({
        success: true as const,
        data: interactions.map((i) => ({
          id: i.id,
          userPrompt: i.userPrompt,
          modelResponse: i.modelResponse,
          code: i.code,
          stdout: i.stdout,
          createdAt: i.createdAt.toISOString(),
        })),
      });
    },
  );
}
