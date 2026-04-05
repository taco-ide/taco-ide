import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import {
  challenge,
  knowledgeBase,
  knowledgeBaseDocument,
  challengeKnowledgeBase,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListChallengeKBsParamsSchema = z.object({
  challengeId: z.string().uuid(),
});

const KnowledgeBaseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  classroomId: z.string(),
  documentCount: z.number(),
  linkedAt: z.string(),
});

const ListChallengeKBsResponseSchema = ResponseSchema200.extend({
  data: z.array(KnowledgeBaseItemSchema),
});

// ==================== ROUTE ====================

export async function listChallengeKnowledgeBasesRoute(
  app: FastifyTypedInstance
) {
  app.get<{
    Params: z.infer<typeof ListChallengeKBsParamsSchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenge-knowledge-bases"],
        summary: "List knowledge bases linked to challenge",
        description:
          "List all knowledge bases associated with a challenge, including document counts.",
        params: ListChallengeKBsParamsSchema,
        response: {
          200: ListChallengeKBsResponseSchema,
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

      const { challengeId } = request.params;

      // Fetch challenge, validate exists and not deleted
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

      // IDOR: teacher can only view own challenges' KBs
      if (usr.role === "teacher" && ch[0].createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message:
            "You can only view knowledge bases for your own challenges",
        });
      }

      // Document count subquery
      const docCountSubquery = db
        .select({
          knowledgeBaseId: knowledgeBaseDocument.knowledgeBaseId,
          count: sql<number>`count(*)::int`.as("doc_count"),
        })
        .from(knowledgeBaseDocument)
        .where(isNull(knowledgeBaseDocument.deletedAt))
        .groupBy(knowledgeBaseDocument.knowledgeBaseId)
        .as("doc_counts");

      // Join M2M -> knowledgeBase with doc counts
      const results = await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          description: knowledgeBase.description,
          classroomId: knowledgeBase.classroomId,
          documentCount: sql<number>`coalesce(${docCountSubquery.count}, 0)`,
          linkedAt: challengeKnowledgeBase.createdAt,
        })
        .from(challengeKnowledgeBase)
        .innerJoin(
          knowledgeBase,
          and(
            eq(challengeKnowledgeBase.knowledgeBaseId, knowledgeBase.id),
            isNull(knowledgeBase.deletedAt)
          )
        )
        .leftJoin(
          docCountSubquery,
          eq(knowledgeBase.id, docCountSubquery.knowledgeBaseId)
        )
        .where(eq(challengeKnowledgeBase.challengeId, challengeId));

      return reply.status(200).send({
        success: true as const,
        data: results.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          classroomId: r.classroomId,
          documentCount: r.documentCount ?? 0,
          linkedAt: r.linkedAt.toISOString(),
        })),
      });
    }
  );
}
