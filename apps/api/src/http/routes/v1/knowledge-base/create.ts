import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase, challenge } from "@repo/infra/db/schema";
import { generateEmbedding } from "../../../../services/embedding";

// ==================== SCHEMAS ====================

const CreateKnowledgeBaseBodySchema = z.object({
  content: z.string().min(1),
});

const KnowledgeBaseSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

const CreateKnowledgeBaseResponseSchema = ResponseSchema201.extend({
  data: KnowledgeBaseSchema,
});

// ==================== ROUTE ====================

export async function createKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof CreateKnowledgeBaseBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("knowledgeBase", "create")],
      schema: {
        tags: ["knowledge-base"],
        summary: "Create knowledge base entry",
        description: "Create a new knowledge base entry for a challenge",
        params: z.object({ id: z.string().uuid() }),
        body: CreateKnowledgeBaseBodySchema,
        response: {
          201: CreateKnowledgeBaseResponseSchema,
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

      const challengeId = request.params.id;

      const ch = await db
        .select({
          id: challenge.id,
          classroomId: challenge.classroomId,
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

      const { content } = request.body;
      const organizationId = usr.activeOrganizationId;
      const classroomId = ch[0].classroomId;

      const [entry] = await db
        .insert(knowledgeBase)
        .values({
          id: randomUUID(),
          challengeId,
          organizationId,
          classroomId,
          content,
        })
        .returning();

      if (!entry) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create knowledge base entry",
        });
      }

      // Fire-and-forget: generate embedding and update entry
      generateEmbedding(content)
        .then(async (embedding) => {
          if (embedding) {
            await db
              .update(knowledgeBase)
              .set({ embedding })
              .where(eq(knowledgeBase.id, entry.id));
          }
        })
        .catch((err) => request.server.log.error(err));

      return reply.status(201).send({
        success: true as const,
        data: {
          id: entry.id,
          challengeId: entry.challengeId!,
          content: entry.content,
          createdAt: entry.createdAt.toISOString(),
        },
      });
    }
  );
}
