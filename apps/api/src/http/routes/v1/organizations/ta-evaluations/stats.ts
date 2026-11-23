import { z } from "zod";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import {
  assertCanReadOrgEvaluations,
  EvaluationParamsSchema,
  EvaluationQuerySchema,
  GRADES,
  listOrgTeachingAssistants,
  loadRatingGroups,
  minGroupSize,
  summarizeGroups,
  weeksInRange,
} from "./shared";

// ==================== SCHEMAS ====================

const GroupFields = {
  count: z
    .number()
    .int()
    .nullable()
    .describe("Ratings in visible groups; null when all were withheld"),
  mean: z.number().nullable(),
  suppressed: z
    .boolean()
    .describe("Some ratings were withheld (week × TA groups smaller than minGroupSize)"),
};

const EvaluationStatsSchema = z.object({
  minGroupSize: z.number().int(),
  total: GroupFields.count,
  mean: GroupFields.mean,
  suppressed: GroupFields.suppressed,
  distribution: z
    .array(z.object({ grade: z.number().int(), count: z.number().int() }))
    .nullable(),
  weekly: z.array(z.object({ week: z.string(), ...GroupFields })),
  teachingAssistants: z.array(
    z.object({
      id: z.string(),
      alias: z.string(),
      version: z.number().int(),
      isActive: z.boolean(),
      ...GroupFields,
    })
  ),
});

const EvaluationStatsResponseSchema = ResponseSchema200.extend({
  data: EvaluationStatsSchema,
});

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
          "Aggregated anonymous student ratings (1–5) of the organization's teaching assistants: total, mean, distribution per grade, weekly series and per-TA summary. Ratings carry no student, session or classroom link. Small-cell suppression: week × TA groups with fewer than `minGroupSize` ratings (env TA_RATING_MIN_GROUP_SIZE) are withheld from every figure; `suppressed` flags where that happened and `count`/`mean` are null when nothing is left. The weekly series is zero-filled over the requested range (up to the current week). Filter by `teachingAssistantId` and by week range (`from`/`to`, YYYY-MM-DD; a rating counts when its week starts between the start of the week containing `from` and `to`). The per-TA summary honours the date range but not the TA filter. Staff only (teacher, coordinator, admin of the organization, or platform admin).",
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

      const k = minGroupSize();
      const groups = await loadRatingGroups(organizationId, query);
      const filtered = query.teachingAssistantId
        ? groups.filter((g) => g.teachingAssistantId === query.teachingAssistantId)
        : groups;

      const overall = summarizeGroups(filtered, k);
      const pick = ({ count, mean, suppressed }: typeof overall) => ({
        count,
        mean,
        suppressed,
      });

      return reply.status(200).send({
        success: true as const,
        data: {
          minGroupSize: k,
          total: overall.count,
          mean: overall.mean,
          suppressed: overall.suppressed,
          distribution: overall.distribution
            ? GRADES.map((grade, i) => ({
                grade,
                count: overall.distribution![i]!,
              }))
            : null,
          weekly: weeksInRange(
            query,
            filtered.map((g) => g.week)
          ).map((week) => ({
            week,
            ...pick(summarizeGroups(filtered.filter((g) => g.week === week), k)),
          })),
          teachingAssistants: tas.map((t) => ({
            ...t,
            ...pick(
              summarizeGroups(
                groups.filter((g) => g.teachingAssistantId === t.id),
                k
              )
            ),
          })),
        },
      });
    }
  );
}
