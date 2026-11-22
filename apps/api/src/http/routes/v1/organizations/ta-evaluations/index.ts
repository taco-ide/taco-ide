import { FastifyTypedInstance } from "../../../../types";
import { teachingAssistantEvaluationStatsRoute } from "./stats";
import { teachingAssistantEvaluationExportRoute } from "./export";

/** Issue #99 — anonymous TA rating statistics, under /organizations/:id. */
export async function teachingAssistantEvaluationRoutes(
  app: FastifyTypedInstance
) {
  await teachingAssistantEvaluationStatsRoute(app);
  await teachingAssistantEvaluationExportRoute(app);
}
