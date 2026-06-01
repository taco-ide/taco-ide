import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
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

const UpdateBodySchema = z.object({
  code: z.string().min(1),
  language: z.enum(["python"]).optional(),
});

const ReferenceSolutionSchema = z.object({
  kind: z.enum(["brute_force", "refined"]),
  language: z.string(),
  code: z.string().nullable(),
  status: z.enum(["pending", "running", "complete", "failed"]),
  error: z.string().nullable(),
  createdBy: z.enum(["ai", "manual"]),
  generatedAt: z.string().nullable(),
  updatedAt: z.string(),
});

const UpdateResponseSchema = ResponseSchema200.extend({
  data: ReferenceSolutionSchema,
});

// ==================== ROUTE ====================

export async function updateRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof ParamsSchema>;
    Body: z.infer<typeof UpdateBodySchema>;
  }>(
    "/:kind",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges/reference-solutions"],
        summary: "Manually override reference solution",
        description: "Manually create or update a reference solution",
        params: ParamsSchema,
        body: UpdateBodySchema,
        response: {
          200: UpdateResponseSchema,
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
      const { challengeId, kind } = request.params;
      const { code, language = "python" } = request.body;

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

      // Upsert the row
      await db
        .insert(challengeReferenceSolution)
        .values({
          id: randomUUID(),
          challengeId,
          kind,
          language,
          code,
          status: "complete",
          createdBy: "manual",
          generatedAt: new Date(),
          error: null,
        })
        .onConflictDoUpdate({
          target: [
            challengeReferenceSolution.challengeId,
            challengeReferenceSolution.kind,
          ],
          set: {
            code,
            language,
            status: "complete",
            createdBy: "manual",
            generatedAt: new Date(),
            error: null,
            updatedAt: new Date(),
          },
        });

      // Re-read and return the row
      const [row] = await db
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
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeId),
            eq(challengeReferenceSolution.kind, kind),
          ),
        )
        .limit(1);

      if (!row) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to retrieve updated solution",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          kind: row.kind as "brute_force" | "refined",
          language: row.language,
          code: row.code ?? null,
          status: row.status as "pending" | "running" | "complete" | "failed",
          error: row.error ?? null,
          createdBy: row.createdBy as "ai" | "manual",
          generatedAt: row.generatedAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
        },
      });
    }
  );
}
