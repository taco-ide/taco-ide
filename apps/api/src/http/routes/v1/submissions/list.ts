import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { submission, user } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";

const ListSubmissionsParamsSchema = z.object({
  challengeId: z.string().uuid(),
});

const ListSubmissionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(50).default(20),
});

const SubmissionRowSchema = z.object({
  submissionId: z.string(),
  workSessionId: z.string(),
  studentUserId: z.string(),
  studentName: z.string(),
  submittedAt: z.string(),
  grade: z.string().nullable(),
  autoReview: z.string().nullable(),
  autoReviewAt: z.string().nullable(),
  gradedAt: z.string().nullable(),
});

const ListSubmissionsResponseSchema = ResponseSchema200.extend({
  data: z.array(SubmissionRowSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

const AUTO_REVIEW_PREVIEW_CHARS = 200;

export async function listSubmissionsRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ListSubmissionsParamsSchema>;
    Querystring: z.infer<typeof ListSubmissionsQuerySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["submissions"],
        summary: "List submissions for a challenge (staff)",
        description:
          "Paginated list of student submissions for a challenge. Same access rules as work-session list: teacher (creator or classroom lead), coordinator+ in org.",
        params: ListSubmissionsParamsSchema,
        querystring: ListSubmissionsQuerySchema,
        response: {
          200: ListSubmissionsResponseSchema,
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
      const { page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const listAccess = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!listAccess.ok) {
        return reply.status(listAccess.status).send({
          success: false as const,
          message: listAccess.message,
        });
      }

      const whereSub = eq(submission.challengeId, challengeId);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(submission)
        .where(whereSub);

      const total = Number(countResult[0]?.count ?? 0);
      const totalPages = Math.ceil(total / perPage) || 0;

      const rows = await db
        .select({
          submissionId: submission.id,
          workSessionId: submission.workSessionId,
          studentUserId: submission.studentUserId,
          studentName: user.name,
          submittedAt: submission.submittedAt,
          grade: submission.grade,
          autoReview: submission.autoReview,
          autoReviewAt: submission.autoReviewAt,
          gradedAt: submission.gradedAt,
        })
        .from(submission)
        .innerJoin(user, eq(submission.studentUserId, user.id))
        .where(whereSub)
        .orderBy(desc(submission.submittedAt))
        .limit(perPage)
        .offset(offset);

      return reply.status(200).send({
        success: true as const,
        data: rows.map((r) => ({
          submissionId: r.submissionId,
          workSessionId: r.workSessionId,
          studentUserId: r.studentUserId,
          studentName: r.studentName,
          submittedAt: r.submittedAt.toISOString(),
          grade: r.grade ?? null,
          autoReview:
            r.autoReview && r.autoReview.length > AUTO_REVIEW_PREVIEW_CHARS
              ? r.autoReview.slice(0, AUTO_REVIEW_PREVIEW_CHARS)
              : (r.autoReview ?? null),
          autoReviewAt: r.autoReviewAt?.toISOString() ?? null,
          gradedAt: r.gradedAt?.toISOString() ?? null,
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
