import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase, knowledgeBaseChunk } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../../services/embedding";

// ==================== SCHEMAS ====================

const CreateEntryParamsSchema = z.object({
  kbId: z.string().uuid(),
});

const CreateEntryBodySchema = z.object({
  content: z.string().min(1),
});

const EntryCreatedSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

const CreateEntryResponseSchema = ResponseSchema201.extend({
  data: EntryCreatedSchema,
});

// ==================== ROUTE ====================

export async function createEntryRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof CreateEntryParamsSchema>;
    Body: z.infer<typeof CreateEntryBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("knowledgeBase", "create")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Create manual knowledge base entry",
        description: "Create a manual chunk entry in the knowledge base (no document)",
        params: CreateEntryParamsSchema,
        body: CreateEntryBodySchema,
        response: {
          201: CreateEntryResponseSchema,
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

      const { content } = request.body;

      const [entry] = await db
        .insert(knowledgeBaseChunk)
        .values({
          id: randomUUID(),
          documentId: null,
          knowledgeBaseId: kbId,
          chunkIndex: null,
          content,
          metadata: null,
        })
        .returning();

      if (!entry) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create entry",
        });
      }

      // Fire-and-forget: generate embedding
      generateEmbedding(content)
        .then(async (embedding) => {
          if (embedding) {
            await db
              .update(knowledgeBaseChunk)
              .set({ embedding })
              .where(eq(knowledgeBaseChunk.id, entry.id));
          }
        })
        .catch((err) =>
          request.server.log.warn(
            { err, chunkId: entry.id, context: "embedding_generation" },
            "Failed to generate embedding for manual entry"
          )
        );

      return reply.status(201).send({
        success: true as const,
        data: {
          id: entry.id,
          content: entry.content,
          createdAt: entry.createdAt.toISOString(),
        },
      });
    }
  );
}
