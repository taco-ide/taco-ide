import { z } from "zod";
import { eq } from "drizzle-orm";
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
});

const ReferenceSolutionItemSchema = z.object({
  kind: z.enum(["brute_force", "refined"]),
  language: z.string(),
  code: z.string().nullable(),
  status: z.enum(["pending", "running", "complete", "failed"]),
  error: z.string().nullable(),
  createdBy: z.enum(["ai", "manual"]),
  generatedAt: z.string().nullable(),
  updatedAt: z.string(),
});

const ListResponseSchema = ResponseSchema200.extend({
  data: z.array(ReferenceSolutionItemSchema),
});

// ==================== ROUTE ====================

export async function listRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ParamsSchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges/reference-solutions"],
        summary: "List reference solutions",
        description: "List all reference solutions for a challenge",
        params: ParamsSchema,
        response: {
          200: ListResponseSchema,
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
      const { challengeId } = request.params;

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

      const rows = await db
        .select({
          kind: challengeReferenceSolution.kind,
          language: challengeReferenceSolution.language,
          code: challengeReferenceSolution.code,
          status: challengeReferenceSolution.status,
          error: challengeReferenceSolution.error,
          createdBy: challengeReferenceSolution.createdBy,
          generatedAt: challengeReferenceSolution.generatedAt,
          updatedAt: challengeReferenceSolution.updatedAt,
        })
        .from(challengeReferenceSolution)
        .where(eq(challengeReferenceSolution.challengeId, challengeId));

      return reply.status(200).send({
        success: true as const,
        data: rows.map((r) => ({
          kind: r.kind as "brute_force" | "refined",
          language: r.language,
          code: r.code ?? null,
          status: r.status as "pending" | "running" | "complete" | "failed",
          error: r.error ?? null,
          createdBy: r.createdBy as "ai" | "manual",
          generatedAt: r.generatedAt?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    }
  );
}
