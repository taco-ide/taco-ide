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
      const { challengeId, kind } = request.params;

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
