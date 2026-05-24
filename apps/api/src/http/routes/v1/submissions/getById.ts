import { z } from "zod";
import { eq, and } from "drizzle-orm";
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

const ParamsSchema = z.object({
  challengeId: z.string().uuid(),
  submissionId: z.string().min(1),
});

const SubmissionDetailSchema = z.object({
  submissionId: z.string(),
  workSessionId: z.string(),
  challengeId: z.string(),
  studentUserId: z.string(),
  studentName: z.string(),
  code: z.string().nullable(),
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  submittedAt: z.string(),
  grade: z.string().nullable(),
  gradingComment: z.string().nullable(),
  gradedByUserId: z.string().nullable(),
  gradedAt: z.string().nullable(),
  autoReview: z.string().nullable(),
  autoReviewAt: z.string().nullable(),
});

const GetSubmissionResponseSchema = ResponseSchema200.extend({
  data: SubmissionDetailSchema,
});

export async function getSubmissionByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ParamsSchema>;
  }>(
    "/:submissionId",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["submissions"],
        summary: "Get submission by id",
        description:
          "Full submission detail, including the code snapshot, auto-review, and grading fields. Staff-only.",
        params: ParamsSchema,
        response: {
          200: GetSubmissionResponseSchema,
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

      const { challengeId, submissionId } = request.params;

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

      const [row] = await db
        .select({
          submissionId: submission.id,
          workSessionId: submission.workSessionId,
          challengeId: submission.challengeId,
          studentUserId: submission.studentUserId,
          studentName: user.name,
          code: submission.code,
          stdin: submission.stdin,
          stdout: submission.stdout,
          submittedAt: submission.submittedAt,
          grade: submission.grade,
          gradingComment: submission.gradingComment,
          gradedByUserId: submission.gradedByUserId,
          gradedAt: submission.gradedAt,
          autoReview: submission.autoReview,
          autoReviewAt: submission.autoReviewAt,
        })
        .from(submission)
        .innerJoin(user, eq(submission.studentUserId, user.id))
        .where(
          and(
            eq(submission.id, submissionId),
            eq(submission.challengeId, challengeId)
          )
        )
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          success: false as const,
          message: "Submission not found",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          submissionId: row.submissionId,
          workSessionId: row.workSessionId,
          challengeId: row.challengeId,
          studentUserId: row.studentUserId,
          studentName: row.studentName,
          code: row.code ?? null,
          stdin: row.stdin ?? null,
          stdout: row.stdout ?? null,
          submittedAt: row.submittedAt.toISOString(),
          grade: row.grade ?? null,
          gradingComment: row.gradingComment ?? null,
          gradedByUserId: row.gradedByUserId ?? null,
          gradedAt: row.gradedAt?.toISOString() ?? null,
          autoReview: row.autoReview ?? null,
          autoReviewAt: row.autoReviewAt?.toISOString() ?? null,
        },
      });
    }
  );
}
