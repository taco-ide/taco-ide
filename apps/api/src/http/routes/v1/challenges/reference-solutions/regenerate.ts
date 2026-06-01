import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
  ResponseSchema429,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { challengeReferenceSolution } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../../services/work-session-access";
import { generateReferenceSolutions } from "../../../../../agents/teachers-companion/reference-solution";

// ==================== SCHEMAS ====================

const ParamsSchema = z.object({
  challengeId: z.string().min(1),
  kind: z.enum(["brute_force", "refined"]),
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

const RegenerateResponseSchema = ResponseSchema200.extend({
  data: ReferenceSolutionSchema,
});

// ==================== ROUTE ====================

export async function regenerateRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ParamsSchema>;
  }>(
    "/:kind/regenerate",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenges/reference-solutions"],
        summary: "Regenerate reference solution",
        description:
          "Regenerate a reference solution with 409 (already running) and 429 (cooldown) guards",
        params: ParamsSchema,
        response: {
          200: RegenerateResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
          429: ResponseSchema429,
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

      // Load existing row if any
      const [existing] = await db
        .select({
          status: challengeReferenceSolution.status,
          generatedAt: challengeReferenceSolution.generatedAt,
        })
        .from(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeId),
            eq(challengeReferenceSolution.kind, kind),
          ),
        )
        .limit(1);

      // 409 — already running
      if (existing?.status === "running") {
        return reply.status(409).send({
          success: false as const,
          message: "Geração já em execução",
        });
      }

      // 429 — cooldown: last successful generation was less than 60 s ago
      const COOLDOWN_MS = 60_000;
      if (existing?.generatedAt) {
        const elapsed = Date.now() - existing.generatedAt.getTime();
        if (elapsed < COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
          return reply.status(429).send({
            success: false as const,
            message: `Aguarde ${remainingSeconds}s antes de tentar novamente`,
          });
        }
      }

      // Fire generator (awaited, so response includes final state)
      await generateReferenceSolutions(challengeId, [kind as "brute_force" | "refined"]);

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
          message: "Failed to retrieve regenerated solution",
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
