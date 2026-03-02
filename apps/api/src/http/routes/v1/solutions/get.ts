import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { challengeSolution, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================


const SolutionSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  chatHistory: z.unknown().nullable(),
  updatedAt: z.string(),
});

const GetSolutionResponseSchema = ResponseSchema200.extend({
  data: SolutionSchema,
});

// ==================== ROUTE ====================

export async function getSolutionRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: { id: string };
  }>(
    "/",
    {
      schema: {
        tags: ["solutions"],
        summary: "Get solution for challenge",
        description: "Returns the current user's solution state for a challenge",
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: GetSolutionResponseSchema,
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

      const challengeId = request.params.id;

      const ch = await db
        .select({ id: challenge.id })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const [solution] = await db
        .select()
        .from(challengeSolution)
        .where(
          and(
            eq(challengeSolution.userId, usr.id),
            eq(challengeSolution.challengeId, challengeId)
          )
        )
        .limit(1);

      if (!solution) {
        return reply.status(404).send({
          success: false as const,
          message: "No solution found for this challenge",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: solution.id,
          code: solution.code,
          stdin: solution.stdin,
          stdout: solution.stdout,
          chatHistory: solution.chatHistory,
          updatedAt: solution.updatedAt.toISOString(),
        },
      });
    }
  );
}
