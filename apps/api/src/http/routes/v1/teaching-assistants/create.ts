import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
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
  isOrganizationDefault,
} from "../../../services/teaching-assistant-access";
import {
  ALIAS_CONFLICT_MESSAGE,
  TeachingAssistantModelParametersSchema,
  TeachingAssistantSchema,
  isAliasConflict,
  saveModelParameters,
  serializeTeachingAssistant,
} from "./shared";

export const CreateTeachingAssistantBodySchema = z
  .object({
    organizationId: z.string().min(1).optional(),
    alias: z.string().trim().min(1).max(50),
    description: z.string().max(2000).nullable().optional(),
    systemPrompt: z.string().trim().min(1).max(20000),
    targetAudience: z.string().trim().max(50).nullable().optional(),
    isActive: z.boolean().optional().default(true),
    modelParameters: TeachingAssistantModelParametersSchema.nullable().optional(),
  })
  .strict();

const CreateTeachingAssistantResponseSchema = ResponseSchema201.extend({
  data: TeachingAssistantSchema,
});

export async function createTeachingAssistantRoute(app: FastifyTypedInstance) {
  app.post<{ Body: z.infer<typeof CreateTeachingAssistantBodySchema> }>(
    "/",
    {
      preHandler: [requirePermission("teachingAssistant", "create")],
      schema: {
        tags: ["teaching-assistants"],
        summary: "Create teaching assistant",
        description:
          "Create a teaching assistant in an organization (defaults to the active organization). Requires the teachingAssistant:create permission in that organization, or platform admin.",
        body: CreateTeachingAssistantBodySchema,
        response: {
          201: CreateTeachingAssistantResponseSchema,
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

      const body = request.body;
      const organizationId =
        body.organizationId ?? usr.activeOrganizationId ?? null;
      if (!organizationId)
        return reply.status(400).send({
          success: false as const,
          message: "No active organization selected",
        });

      const access = await assertCanAccessTeachingAssistantOrg(
        usr,
        organizationId,
        "create"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const id = randomUUID();
      try {
        const created = await db.transaction(async (tx) => {
          await tx.insert(teachingAssistant).values({
            id,
            alias: body.alias,
            version: 1,
            systemPrompt: body.systemPrompt,
            description: body.description ?? null,
            targetAudience: body.targetAudience || null,
            isActive: body.isActive,
            createdByOrganizationId: organizationId,
          });
          const modelId = await saveModelParameters(
            tx,
            id,
            null,
            body.modelParameters ?? null
          );
          const [row] = await tx
            .update(teachingAssistant)
            .set({ modelId })
            .where(eq(teachingAssistant.id, id))
            .returning();
          return row!;
        });

        return reply.status(201).send({
          success: true as const,
          data: serializeTeachingAssistant(
            created,
            body.modelParameters ?? null,
            0,
            await isOrganizationDefault(created)
          ),
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
