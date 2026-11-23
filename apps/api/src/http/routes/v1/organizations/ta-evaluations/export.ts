import { z } from "zod";
import { FastifyTypedInstance } from "../../../../types";
import {
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
} from "./shared";

const CSV_HEADER = [
  "week",
  "teaching_assistant_id",
  "teaching_assistant_alias",
  "teaching_assistant_version",
  "count",
  "mean",
  ...GRADES.map((g) => `grade_${g}`),
  "suppressed",
];

/** Lets Excel detect UTF-8 (PT-BR accents in aliases). */
const UTF8_BOM = "\uFEFF";

function csvCell(value: string | number | boolean): string {
  let str = String(value);
  // Neutralise spreadsheet formula injection (aliases are user-provided).
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function teachingAssistantEvaluationExportRoute(
  app: FastifyTypedInstance
) {
  app.get(
    "/teaching-assistant-evaluations/export",
    {
      schema: {
        tags: ["organizations"],
        summary: "Export anonymous teaching assistant ratings as CSV",
        description:
          "CSV (text/csv) of the organization's anonymous TA ratings for research use: one aggregated row per week × TA with the rating count, mean and count per grade (1–5), sorted by week and TA. Rows of groups with fewer than TA_RATING_MIN_GROUP_SIZE ratings are suppressed (empty figures, `suppressed=true`). Never one row per rating; no student, session or classroom. UTF-8 with BOM. Same filters and authorization as the stats endpoint.",
        params: EvaluationParamsSchema,
        querystring: EvaluationQuerySchema,
        response: {
          200: z.string().describe("text/csv"),
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
      // listOrgTeachingAssistants is ordered by alias, version.
      const taOrder = new Map(tas.map((t, i) => [t.id, i]));
      const taById = new Map(tas.map((t) => [t.id, t]));
      const groups = (await loadRatingGroups(organizationId, query))
        .filter(
          (g) =>
            !query.teachingAssistantId ||
            g.teachingAssistantId === query.teachingAssistantId
        )
        .sort(
          (a, b) =>
            a.week.localeCompare(b.week) ||
            taOrder.get(a.teachingAssistantId)! - taOrder.get(b.teachingAssistantId)!
        );

      const lines = [
        CSV_HEADER.join(","),
        ...groups.map((g) => {
          const ta = taById.get(g.teachingAssistantId)!;
          const s = summarizeGroups([g], k);
          const figures = s.distribution
            ? [s.count!, s.mean!, ...s.distribution]
            : ["", "", ...GRADES.map(() => "")];
          return [g.week, ta.id, ta.alias, ta.version, ...figures, s.suppressed]
            .map(csvCell)
            .join(",");
        }),
      ];

      const filename = `ta-ratings-${organizationId}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      return reply
        .status(200)
        .header("content-disposition", `attachment; filename="${filename}"`)
        .type("text/csv; charset=utf-8")
        .send(`${UTF8_BOM}${lines.join("\n")}\n`);
    }
  );
}
