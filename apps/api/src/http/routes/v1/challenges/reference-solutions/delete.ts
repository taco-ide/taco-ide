import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { challengeReferenceSolution } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../../services/work-session-access";

// ==================== SCHEMAS ====================

const ParamsSchema = z.object({
  challengeId: z.string().min(1),
  kind: z.enum(["brute_force", "refined"]),
});

const DeleteResponseSchema = ResponseSchema200.extend({
  data: z.object({
    kind: z.enum(["brute_force", "refined"]),
  }),
});

// ==================== ROUTE ====================

export async function deleteRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof ParamsSchema>;
  }>(
    "/:kind",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges/reference-solutions"],
        summary: "Delete reference solution",
        description: "Delete a reference solution",
        params: ParamsSchema,
        response: {
          200: DeleteResponseSchema,
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
      const { challengeId, kind } = request.params;

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }
      const access = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!access.ok) {
        return reply.status(access.status).send({
          success: false as const,
          message: access.message,
        });
      }

      await db
        .delete(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeId),
            eq(challengeReferenceSolution.kind, kind),
          ),
        );

      return reply.status(200).send({
        success: true as const,
        data: {
          kind: kind as "brute_force" | "refined",
        },
      });
    }
  );
}
