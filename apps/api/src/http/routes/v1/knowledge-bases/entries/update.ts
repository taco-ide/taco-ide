import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase, knowledgeBaseChunk } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../../services/embedding";

// ==================== SCHEMAS ====================

const UpdateEntryParamsSchema = z.object({
  kbId: z.string().min(1),
  entryId: z.string().min(1),
});

const UpdateEntryBodySchema = z.object({
  content: z.string().min(1),
});

const EntryUpdatedSchema = z.object({
  id: z.string(),
  content: z.string(),
  updatedAt: z.string(),
});

const UpdateEntryResponseSchema = ResponseSchema200.extend({
  data: EntryUpdatedSchema,
});

// ==================== ROUTE ====================

export async function updateEntryRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof UpdateEntryParamsSchema>;
    Body: z.infer<typeof UpdateEntryBodySchema>;
  }>(
    "/:entryId",
    {
      preHandler: [requirePermission("knowledgeBase", "update")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Update manual knowledge base entry",
        description: "Update a manual entry and regenerate its embedding",
        params: UpdateEntryParamsSchema,
        body: UpdateEntryBodySchema,
        response: {
          200: UpdateEntryResponseSchema,
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

      const { kbId, entryId } = request.params;

      const kb = await db
        .select({
          id: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          createdByUserId: knowledgeBase.createdByUserId,
        })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
        .limit(1);

      if (!kb[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      if (kb[0].organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Knowledge base does not belong to your active organization",
        });
      }

      if (usr.role === "teacher" && kb[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only manage entries in your own knowledge bases",
        });
      }

      // Manual entries have documentId IS NULL and knowledgeBaseId set
      const existing = await db
        .select({ id: knowledgeBaseChunk.id })
        .from(knowledgeBaseChunk)
        .where(
          and(
            eq(knowledgeBaseChunk.id, entryId),
            eq(knowledgeBaseChunk.knowledgeBaseId, kbId),
            isNull(knowledgeBaseChunk.documentId),
            isNull(knowledgeBaseChunk.deletedAt)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Entry not found",
        });
      }

      const { content } = request.body;

      const [updated] = await db
        .update(knowledgeBaseChunk)
        .set({ content, updatedAt: new Date() })
        .where(eq(knowledgeBaseChunk.id, entryId))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update entry",
        });
      }

      // Fire-and-forget: regenerate embedding after content update
      generateEmbedding(content)
        .then(async (embedding) => {
          if (embedding) {
            await db
              .update(knowledgeBaseChunk)
              .set({ embedding })
              .where(eq(knowledgeBaseChunk.id, entryId));
          }
        })
        .catch((err) =>
          request.server.log.warn(
            { err, chunkId: entryId, context: "embedding_generation" },
            "Failed to generate embedding for manual entry"
          )
        );

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          content: updated.content,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }
  );
}
