import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import {
  assertCanAccessTeachingAssistantOrg,
  isOrganizationDefault,
  listActiveLinkedChallenges,
  loadTeachingAssistant,
} from "../../../services/teaching-assistant-access";
import {
  TeachingAssistantParamsSchema,
  TeachingAssistantSchema,
  loadModelParameters,
  serializeTeachingAssistant,
} from "./shared";

const GetTeachingAssistantResponseSchema = ResponseSchema200.extend({
  data: TeachingAssistantSchema,
});

export async function getTeachingAssistantRoute(app: FastifyTypedInstance) {
  app.get<{ Params: z.infer<typeof TeachingAssistantParamsSchema> }>(
    "/:id",
    {
      schema: {
        tags: ["teaching-assistants"],
        summary: "Get teaching assistant",
        description:
          "Get a teaching assistant. Requires teacher, coordinator or admin membership in the assistant's organization, or platform admin.",
        params: TeachingAssistantParamsSchema,
        response: {
          200: GetTeachingAssistantResponseSchema,
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

      const ta = await loadTeachingAssistant(request.params.id);
      if (!ta)
        return reply.status(404).send({
          success: false as const,
          message: "Teaching assistant not found",
        });

      const access = await assertCanAccessTeachingAssistantOrg(
        usr,
        ta.createdByOrganizationId,
        "read"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const [params, linked] = await Promise.all([
        loadModelParameters(ta.modelId),
        listActiveLinkedChallenges(ta.id),
      ]);

      return reply.status(200).send({
        success: true as const,
        data: serializeTeachingAssistant(
          ta,
          params,
          linked.length,
          await isOrganizationDefault(ta)
        ),
      });
    }
  );
}
