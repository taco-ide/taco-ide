import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { model, teachingAssistant } from "@repo/infra/db/schema";
import {
  assertCanAccessTeachingAssistantOrg,
  countActiveLinkedChallenges,
} from "../../../services/teaching-assistant-access";
import {
  TeachingAssistantSchema,
  parseModelParameters,
  serializeTeachingAssistant,
} from "./shared";

const ListTeachingAssistantsQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  status: z.enum(["all", "active"]).optional().default("all"),
});

const ListTeachingAssistantsResponseSchema = ResponseSchema200.extend({
  data: z.array(TeachingAssistantSchema),
});

export async function listTeachingAssistantsRoute(app: FastifyTypedInstance) {
  app.get<{ Querystring: z.infer<typeof ListTeachingAssistantsQuerySchema> }>(
    "/",
    {
      schema: {
        tags: ["teaching-assistants"],
        summary: "List teaching assistants",
        description:
          "List the non-deleted teaching assistants of an organization (defaults to the active organization). Requires teacher, coordinator or admin membership in that organization, or platform admin.",
        querystring: ListTeachingAssistantsQuerySchema,
        response: {
          200: ListTeachingAssistantsResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr)
        return reply
          .status(401)
          .send({ success: false as const, message: "Not authenticated" });

      const organizationId =
        request.query.organizationId ?? usr.activeOrganizationId ?? null;
      if (!organizationId)
        return reply.status(400).send({
          success: false as const,
          message: "No active organization selected",
        });

      const access = await assertCanAccessTeachingAssistantOrg(
        usr,
        organizationId,
        "read"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const rows = await db
        .select()
        .from(teachingAssistant)
        .where(
          and(
            eq(teachingAssistant.createdByOrganizationId, organizationId),
            isNull(teachingAssistant.deletedAt),
            request.query.status === "active"
              ? eq(teachingAssistant.isActive, true)
              : undefined
          )
        )
        .orderBy(desc(teachingAssistant.isActive), asc(teachingAssistant.alias));

      const modelIds = rows
        .map((r) => r.modelId)
        .filter((id): id is string => !!id);
      const models = modelIds.length
        ? await db
            .select({ id: model.id, modelParameters: model.modelParameters })
            .from(model)
            .where(inArray(model.id, modelIds))
        : [];
      const paramsByModel = new Map(
        models.map((m) => [m.id, parseModelParameters(m.modelParameters)])
      );
      const counts = await countActiveLinkedChallenges(organizationId);

      return reply.status(200).send({
        success: true as const,
        data: rows.map((ta) =>
          serializeTeachingAssistant(
            ta,
            ta.modelId ? (paramsByModel.get(ta.modelId) ?? null) : null,
            counts.get(ta.id) ?? 0
          )
        ),
      });
    }
  );
}
