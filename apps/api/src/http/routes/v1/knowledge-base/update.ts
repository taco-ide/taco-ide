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
import { knowledgeBase, challenge } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../services/embedding";

// ==================== SCHEMAS ====================

const UpdateKnowledgeBaseParamsSchema = z.object({
  id: z.string().uuid(),
  kbId: z.string().uuid(),
});

const UpdateKnowledgeBaseBodySchema = z.object({
  content: z.string().min(1),
});

const KnowledgeBaseSchema = z.object({
  id: z.string(),
  content: z.string(),
  updatedAt: z.string(),
});

const UpdateKnowledgeBaseResponseSchema = ResponseSchema200.extend({
  data: KnowledgeBaseSchema,
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
        tags: ["knowledge-base"],
        summary: "Update knowledge base entry",
        description: "Update an existing knowledge base entry for a challenge",
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

      const { id: challengeId, kbId } = request.params;

      const ch = await db
        .select({
          id: challenge.id,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      if (
        usr.role === "teacher" &&
        ch[0].createdByUserId !== usr.id
      ) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only manage knowledge base entries for your own challenges",
        });
      }

      const existing = await db
        .select({ id: knowledgeBase.id, challengeId: knowledgeBase.challengeId })
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.id, kbId),
            eq(knowledgeBase.challengeId, challengeId),
            isNull(knowledgeBase.deletedAt)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base entry not found",
        });
      }

      const { content } = request.body;

      const [updated] = await db
        .update(knowledgeBase)
        .set({ content, updatedAt: new Date() })
        .where(eq(knowledgeBase.id, kbId))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update knowledge base entry",
        });
      }

      // Fire-and-forget: regenerate embedding after content update
      generateEmbedding(content)
        .then(async (embedding) => {
          if (embedding) {
            await db
              .update(knowledgeBase)
              .set({ embedding })
              .where(eq(knowledgeBase.id, kbId));
          }
        })
        .catch((err) =>
          request.server.log.warn(
            { err, knowledgeBaseEntryId: kbId, context: 'embedding_generation' },
            'Failed to generate embedding for knowledge base entry'
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
