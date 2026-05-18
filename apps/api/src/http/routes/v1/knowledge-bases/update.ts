import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const UpdateKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().min(1),
});

const UpdateKnowledgeBaseBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
  })
  .strict();

const KnowledgeBaseUpdatedSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
});

const UpdateKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: KnowledgeBaseUpdatedSchema,
});

// ==================== ROUTE ====================

export async function updateKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof UpdateKnowledgeBaseParamsSchema>;
    Body: z.infer<typeof UpdateKnowledgeBaseBodySchema>;
  }>(
    "/:kbId",
    {
      preHandler: [requirePermission("knowledgeBase", "update")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Update knowledge base",
        description: "Update a knowledge base title or description",
        params: UpdateKnowledgeBaseParamsSchema,
        body: UpdateKnowledgeBaseBodySchema,
        response: {
          200: UpdateKnowledgeBaseResponseSchema,
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

      const { kbId } = request.params;

      const existing = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
        })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      if (existing[0].organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Knowledge base does not belong to your active organization",
        });
      }

      if (
        usr.role === "teacher" &&
        existing[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only update your own knowledge bases",
        });
      }

      const { title, description } = request.body;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;

      const [updated] = await db
        .update(knowledgeBase)
        .set(updateData)
        .where(eq(knowledgeBase.id, kbId))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update knowledge base",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }
  );
}
