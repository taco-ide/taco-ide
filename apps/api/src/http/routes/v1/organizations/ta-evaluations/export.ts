import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
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
  weekLabel,
  weekRangeConditions,
} from "./shared";

const CSV_HEADER = [
  "week",
  "teaching_assistant_id",
  "teaching_assistant_alias",
  "teaching_assistant_version",
  "grade",
];

function csvCell(value: string | number): string {
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
          "CSV (text/csv) of the organization's anonymous TA ratings for research use: one row per rating with week, TA id/alias/version and grade, sorted by week, TA and grade (no rating id, student, session or classroom). Same filters and authorization as the stats endpoint.",
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

      if (query.teachingAssistantId) {
        const tas = await listOrgTeachingAssistants(organizationId);
        if (!tas.some((t) => t.id === query.teachingAssistantId)) {
          return reply.status(404).send({
            success: false as const,
            message: "Teaching assistant not found",
          });
        }
      }

      const conditions = [
        orgScopeCondition(organizationId),
        ...weekRangeConditions(query),
      ];
      if (query.teachingAssistantId) {
        conditions.push(
          eq(teachingAssistantEvaluation.teachingAssistantId, query.teachingAssistantId)
        );
      }

      const rows = await db
        .select({
          week: weekLabel,
          teachingAssistantId: teachingAssistant.id,
          alias: teachingAssistant.alias,
          version: teachingAssistant.version,
          grade: teachingAssistantEvaluation.grade,
        })
        .from(teachingAssistantEvaluation)
        .innerJoin(
          teachingAssistant,
          eq(teachingAssistant.id, teachingAssistantEvaluation.teachingAssistantId)
        )
        .where(and(...conditions))
        .orderBy(
          weekLabel,
          teachingAssistant.alias,
          teachingAssistant.version,
          teachingAssistant.id,
          teachingAssistantEvaluation.grade
        );

      const lines = [
        CSV_HEADER.join(","),
        ...rows.map((r) =>
          [r.week, r.teachingAssistantId, r.alias, r.version, r.grade]
            .map(csvCell)
            .join(",")
        ),
      ];

      const filename = `ta-ratings-${organizationId}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      return reply
        .status(200)
        .header("content-disposition", `attachment; filename="${filename}"`)
        .type("text/csv; charset=utf-8")
        .send(`${lines.join("\n")}\n`);
    }
  );
}
