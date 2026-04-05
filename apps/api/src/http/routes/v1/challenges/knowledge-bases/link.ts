import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  challenge,
  knowledgeBase,
  challengeKnowledgeBase,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const LinkKnowledgeBaseParamsSchema = z.object({
  challengeId: z.string().uuid(),
});

const LinkKnowledgeBaseBodySchema = z.object({
  knowledgeBaseId: z.string().uuid(),
});

const LinkKnowledgeBaseResponseSchema = ResponseSchema201.extend({
  data: z.object({
    challengeId: z.string(),
    knowledgeBaseId: z.string(),
    createdAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function linkKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof LinkKnowledgeBaseParamsSchema>;
    Body: z.infer<typeof LinkKnowledgeBaseBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenge-knowledge-bases"],
        summary: "Link knowledge base to challenge",
        description:
          "Associate a knowledge base with a challenge. Both must belong to the same classroom.",
        params: LinkKnowledgeBaseParamsSchema,
        body: LinkKnowledgeBaseBodySchema,
        response: {
          201: LinkKnowledgeBaseResponseSchema,
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
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { challengeId } = request.params;
      const { knowledgeBaseId } = request.body;

      // 1. Fetch challenge, validate exists and not deleted
      const ch = await db
        .select({
          id: challenge.id,
          classroomId: challenge.classroomId,
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

      // 2. IDOR: teacher can only manage own challenges
      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only manage knowledge bases for your own challenges",
        });
      }

      // 3. Challenge must belong to a classroom
      if (!ch[0].classroomId) {
        return reply.status(400).send({
          success: false as const,
          message:
            "Challenge must belong to a classroom to use knowledge bases",
        });
      }

      // 4. Fetch KB, validate exists and not deleted
      const kb = await db
        .select({
          id: knowledgeBase.id,
          classroomId: knowledgeBase.classroomId,
        })
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.id, knowledgeBaseId),
            isNull(knowledgeBase.deletedAt)
          )
        )
        .limit(1);

      if (!kb[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Knowledge base not found",
        });
      }

      // 5. KB must belong to same classroom as challenge
      if (kb[0].classroomId !== ch[0].classroomId) {
        return reply.status(400).send({
          success: false as const,
          message:
            "Knowledge base must belong to the same classroom as the challenge",
        });
      }

      // 6. Check if link already exists
      const existing = await db
        .select({ challengeId: challengeKnowledgeBase.challengeId })
        .from(challengeKnowledgeBase)
        .where(
          and(
            eq(challengeKnowledgeBase.challengeId, challengeId),
            eq(challengeKnowledgeBase.knowledgeBaseId, knowledgeBaseId)
          )
        )
        .limit(1);

      if (existing[0]) {
        return reply.status(409).send({
          success: false as const,
          message: "Knowledge base is already linked to this challenge",
        });
      }

      // 7. Insert M2M record in transaction
      const [created] = await db.transaction(async (tx) => {
        return tx
          .insert(challengeKnowledgeBase)
          .values({ challengeId, knowledgeBaseId })
          .returning();
      });

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to link knowledge base",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          challengeId: created.challengeId,
          knowledgeBaseId: created.knowledgeBaseId,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
