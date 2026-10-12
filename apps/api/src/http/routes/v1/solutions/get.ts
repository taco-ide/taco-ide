import {
  loadChallengeWorkAccessContext,
  assertCanParticipateInChallengeWorkSession,
} from "../../../services/work-session-access";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";

// ResponseSchema404 is imported to keep the import consistent with other route
// files; only the "Challenge not found" path uses it here.
import { db } from "@repo/infra/db";
import { challengeSolution } from "@repo/infra/db/schema";

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
  data: SolutionSchema.nullable(),
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
        description:
          "Returns the current user's solution state for a challenge",
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: GetSolutionResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404, // challenge not found (solution absence is 200 + data: null)
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

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Challenge not found" });
      const access = await assertCanParticipateInChallengeWorkSession(usr, ctx);
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

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
        return reply.status(200).send({
          success: true as const,
          data: null,
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
