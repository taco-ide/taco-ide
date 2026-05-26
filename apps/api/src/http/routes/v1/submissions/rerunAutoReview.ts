import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
  ResponseSchema429,
  ResponseSchema500,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { submission, autoReviewStatusEnum } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";
import { runAutoReview } from "../../../../agents/teachers-companion/auto-review";

const ParamsSchema = z.object({
  challengeId: z.string().uuid(),
  submissionId: z.string().min(1),
});

const RerunResponseSchema = ResponseSchema200.extend({
  data: z.object({
    submissionId: z.string(),
    autoReview: z.string().nullable(),
    autoReviewAt: z.string().nullable(),
    autoReviewStatus: z.enum(autoReviewStatusEnum),
    autoReviewError: z.string().nullable(),
    generated: z.boolean(),
  }),
});

export async function rerunAutoReviewRoute(app: FastifyTypedInstance) {
  app.post<{ Params: z.infer<typeof ParamsSchema> }>(
    "/:submissionId/auto-review",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["submissions"],
        summary: "Re-run auto review",
        description:
          "Triggers the teacher's-companion auto-review for an existing submission and waits for it to finish. Overwrites any previous auto_review/auto_review_at. Staff-only.",
        params: ParamsSchema,
        response: {
          200: RerunResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
          429: ResponseSchema429,
          500: ResponseSchema500,
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

      const { challengeId, submissionId } = request.params;

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

      const [existing] = await db
        .select({
          id: submission.id,
          autoReviewStatus: submission.autoReviewStatus,
          autoReviewAt: submission.autoReviewAt,
        })
        .from(submission)
        .where(
          and(
            eq(submission.id, submissionId),
            eq(submission.challengeId, challengeId)
          )
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          message: "Submission not found",
        });
      }

      // 409 — already running
      if (existing.autoReviewStatus === "running") {
        return reply.status(409).send({
          success: false as const,
          message: "Avaliação já em execução",
        });
      }

      // 429 — cooldown: last attempt was less than 60 s ago
      const COOLDOWN_MS = 60_000;
      if (existing.autoReviewAt) {
        const elapsed = Date.now() - existing.autoReviewAt.getTime();
        if (elapsed < COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
          return reply.status(429).send({
            success: false as const,
            message: `Aguarde ${remainingSeconds}s antes de tentar novamente`,
          });
        }
      }

      // Await so the professor's UI can show the fresh review immediately
      // on the response. runAutoReview swallows its own errors and only
      // persists on success — re-read the row to know whether it landed.
      await runAutoReview(submissionId);

      const [updated] = await db
        .select({
          id: submission.id,
          autoReview: submission.autoReview,
          autoReviewAt: submission.autoReviewAt,
          autoReviewStatus: submission.autoReviewStatus,
          autoReviewError: submission.autoReviewError,
        })
        .from(submission)
        .where(eq(submission.id, submissionId))
        .limit(1);

      return reply.status(200).send({
        success: true as const,
        data: {
          submissionId,
          autoReview: updated?.autoReview ?? null,
          autoReviewAt: updated?.autoReviewAt?.toISOString() ?? null,
          autoReviewStatus: updated?.autoReviewStatus ?? "pending",
          autoReviewError: updated?.autoReviewError ?? null,
          generated: updated?.autoReviewStatus === "complete",
        },
      });
    }
  );
}
