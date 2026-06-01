import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { submission } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";

const ParamsSchema = z.object({
  challengeId: z.string().uuid(),
  submissionId: z.string().min(1),
});

const GradeBodySchema = z
  .object({
    grade: z.string().min(1).max(10),
    comment: z.string().nullable().optional(),
  })
  .strict();

const GradeResponseSchema = ResponseSchema200.extend({
  data: z.object({
    submissionId: z.string(),
    grade: z.string().nullable(),
    gradingComment: z.string().nullable(),
    gradedByUserId: z.string().nullable(),
    gradedAt: z.string().nullable(),
  }),
});

export async function gradeSubmissionRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof ParamsSchema>;
    Body: z.infer<typeof GradeBodySchema>;
  }>(
    "/:submissionId/grade",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["submissions"],
        summary: "Grade a submission",
        description:
          "Set or update the grade and grading comment for a submission. Staff-only (teacher creator/classroom lead, coordinator+ in org).",
        params: ParamsSchema,
        body: GradeBodySchema,
        response: {
          200: GradeResponseSchema,
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

      const { challengeId, submissionId } = request.params;
      const { grade, comment } = request.body;

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

      const [existing] = await db
        .select({ id: submission.id })
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

      const now = new Date();
      const [updated] = await db
        .update(submission)
        .set({
          grade,
          gradingComment: comment ?? null,
          gradedByUserId: usr.id,
          gradedAt: now,
        })
        .where(
          and(eq(submission.id, submissionId), eq(submission.challengeId, challengeId))
        )
        .returning({
          id: submission.id,
          grade: submission.grade,
          gradingComment: submission.gradingComment,
          gradedByUserId: submission.gradedByUserId,
          gradedAt: submission.gradedAt,
        });

      if (!updated) {
        return reply.status(400).send({
          success: false as const,
          message: "Failed to grade submission",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          submissionId: updated.id,
          grade: updated.grade ?? null,
          gradingComment: updated.gradingComment ?? null,
          gradedByUserId: updated.gradedByUserId ?? null,
          gradedAt: updated.gradedAt?.toISOString() ?? null,
        },
      });
    }
  );
}
