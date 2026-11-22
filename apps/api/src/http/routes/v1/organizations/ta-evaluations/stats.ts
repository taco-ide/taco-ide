import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import {
  teachingAssistant,
  teachingAssistantEvaluation,
} from "@repo/infra/db/schema";
import {
  assertCanReadOrgEvaluations,
  EvaluationParamsSchema,
  EvaluationQuerySchema,
  listOrgTeachingAssistants,
  orgScopeCondition,
  round2,
  weekLabel,
  weekRangeConditions,
} from "./shared";

// ==================== SCHEMAS ====================

const EvaluationStatsSchema = z.object({
  total: z.number().int(),
  mean: z.number().nullable(),
  distribution: z.array(
    z.object({ grade: z.number().int(), count: z.number().int() })
  ),
  weekly: z.array(
    z.object({
      week: z.string(),
      count: z.number().int(),
      mean: z.number(),
    })
  ),
  teachingAssistants: z.array(
    z.object({
      id: z.string(),
      alias: z.string(),
      version: z.number().int(),
      isActive: z.boolean(),
      count: z.number().int(),
      mean: z.number().nullable(),
    })
  ),
});

const EvaluationStatsResponseSchema = ResponseSchema200.extend({
  data: EvaluationStatsSchema,
});

const GRADES = [1, 2, 3, 4, 5] as const;

// ==================== ROUTE ====================

export async function teachingAssistantEvaluationStatsRoute(
  app: FastifyTypedInstance
) {
  app.get(
    "/teaching-assistant-evaluations/stats",
    {
      schema: {
        tags: ["organizations"],
        summary: "Anonymous teaching assistant rating statistics",
        description:
          "Aggregated anonymous student ratings (1–5) of the organization's teaching assistants: total, mean, distribution per grade, weekly series and per-TA summary. Ratings carry no student, session or classroom link. Filter by `teachingAssistantId` and by week range (`from`/`to`, YYYY-MM-DD; a rating counts when its week starts between the start of the week containing `from` and `to`). The per-TA summary honours the date range but not the TA filter. Staff only (teacher, coordinator, admin of the organization, or platform admin).",
        params: EvaluationParamsSchema,
        querystring: EvaluationQuerySchema,
        response: {
          200: EvaluationStatsResponseSchema,
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

      const { id: organizationId } = request.params;
      const query = request.query;

      const access = await assertCanReadOrgEvaluations(usr, organizationId);
      if (!access.ok) {
        return reply.status(access.status).send({
          success: false as const,
          message: access.message,
        });
      }

      const tas = await listOrgTeachingAssistants(organizationId);
      if (
        query.teachingAssistantId &&
        !tas.some((t) => t.id === query.teachingAssistantId)
      ) {
        return reply.status(404).send({
          success: false as const,
          message: "Teaching assistant not found",
        });
      }

      const scoped = [orgScopeCondition(organizationId), ...weekRangeConditions(query)];
      const filtered = query.teachingAssistantId
        ? [
            ...scoped,
            eq(
              teachingAssistantEvaluation.teachingAssistantId,
              query.teachingAssistantId
            ),
          ]
        : scoped;

      const count = sql<number>`count(*)::int`;
      const mean = sql<number>`avg(${teachingAssistantEvaluation.grade})::float8`;

      const [byGrade, byWeek, byTa] = await Promise.all([
        db
          .select({ grade: teachingAssistantEvaluation.grade, count })
          .from(teachingAssistantEvaluation)
          .innerJoin(
            teachingAssistant,
            eq(teachingAssistant.id, teachingAssistantEvaluation.teachingAssistantId)
          )
          .where(and(...filtered))
          .groupBy(teachingAssistantEvaluation.grade),
        db
          .select({ week: weekLabel, count, mean })
          .from(teachingAssistantEvaluation)
          .innerJoin(
            teachingAssistant,
            eq(teachingAssistant.id, teachingAssistantEvaluation.teachingAssistantId)
          )
          .where(and(...filtered))
          .groupBy(weekLabel)
          .orderBy(weekLabel),
        db
          .select({
            teachingAssistantId: teachingAssistantEvaluation.teachingAssistantId,
            count,
            mean,
          })
          .from(teachingAssistantEvaluation)
          .innerJoin(
            teachingAssistant,
            eq(teachingAssistant.id, teachingAssistantEvaluation.teachingAssistantId)
          )
          .where(and(...scoped))
          .groupBy(teachingAssistantEvaluation.teachingAssistantId),
      ]);

      const gradeCounts = new Map(byGrade.map((r) => [r.grade, r.count]));
      const distribution = GRADES.map((grade) => ({
        grade,
        count: gradeCounts.get(grade) ?? 0,
      }));
      const total = byGrade.reduce((acc, r) => acc + r.count, 0);
      const sum = byGrade.reduce((acc, r) => acc + r.grade * r.count, 0);

      const taStats = new Map(byTa.map((r) => [r.teachingAssistantId, r]));

      return reply.status(200).send({
        success: true as const,
        data: {
          total,
          mean: total > 0 ? round2(sum / total) : null,
          distribution,
          weekly: byWeek.map((w) => ({
            week: w.week,
            count: w.count,
            mean: round2(w.mean),
          })),
          teachingAssistants: tas.map((t) => {
            const s = taStats.get(t.id);
            return {
              ...t,
              count: s?.count ?? 0,
              mean: s ? round2(s.mean) : null,
            };
          }),
        },
      });
    }
  );
}
