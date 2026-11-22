import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { teachingAssistant } from "@repo/infra/db/schema";
import {
  assertCanAccessTeachingAssistantOrg,
  listActiveLinkedChallenges,
  loadTeachingAssistant,
} from "../../../services/teaching-assistant-access";
import {
  ALIAS_CONFLICT_MESSAGE,
  TeachingAssistantModelParametersSchema,
  TeachingAssistantParamsSchema,
  TeachingAssistantSchema,
  isAliasConflict,
  loadModelParameters,
  saveModelParameters,
  serializeTeachingAssistant,
} from "./shared";

const UpdateTeachingAssistantBodySchema = z
  .object({
    alias: z.string().trim().min(1).max(50).optional(),
    description: z.string().max(2000).nullable().optional(),
    systemPrompt: z.string().trim().min(1).max(20000).optional(),
    targetAudience: z.string().trim().max(50).nullable().optional(),
    isActive: z.boolean().optional(),
    modelParameters: TeachingAssistantModelParametersSchema.nullable().optional(),
  })
  .strict();

const UpdateTeachingAssistantResponseSchema = ResponseSchema200.extend({
  data: TeachingAssistantSchema,
});

export async function updateTeachingAssistantRoute(app: FastifyTypedInstance) {
  app.patch<{
    Params: z.infer<typeof TeachingAssistantParamsSchema>;
    Body: z.infer<typeof UpdateTeachingAssistantBodySchema>;
  }>(
    "/:id",
    {
      preHandler: [requirePermission("teachingAssistant", "update")],
      schema: {
        tags: ["teaching-assistants"],
        summary: "Update teaching assistant",
        description:
          "Update a teaching assistant's name, description, instructions, audience, model parameters or active flag. Requires the teachingAssistant:update permission in the assistant's organization, or platform admin. Deactivated assistants stop answering students in challenges that use them.",
        params: TeachingAssistantParamsSchema,
        body: UpdateTeachingAssistantBodySchema,
        response: {
          200: UpdateTeachingAssistantResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
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
        "update"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const body = request.body;
      const setValues: Partial<typeof teachingAssistant.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.alias !== undefined) setValues.alias = body.alias;
      if (body.description !== undefined)
        setValues.description = body.description;
      if (body.systemPrompt !== undefined)
        setValues.systemPrompt = body.systemPrompt;
      if (body.targetAudience !== undefined)
        setValues.targetAudience = body.targetAudience || null;
      if (body.isActive !== undefined) setValues.isActive = body.isActive;

      try {
        const updated = await db.transaction(async (tx) => {
          if (body.modelParameters !== undefined)
            setValues.modelId = await saveModelParameters(
              tx,
              ta.id,
              ta.modelId,
              body.modelParameters
            );
          const [row] = await tx
            .update(teachingAssistant)
            .set(setValues)
            .where(eq(teachingAssistant.id, ta.id))
            .returning();
          return row!;
        });

        const [params, linked] = await Promise.all([
          loadModelParameters(updated.modelId),
          listActiveLinkedChallenges(updated.id),
        ]);
        return reply.status(200).send({
          success: true as const,
          data: serializeTeachingAssistant(updated, params, linked.length),
        });
      } catch (error) {
        if (isAliasConflict(error))
          return reply
            .status(409)
            .send({ success: false as const, message: ALIAS_CONFLICT_MESSAGE });
        throw error;
      }
    }
  );
}
