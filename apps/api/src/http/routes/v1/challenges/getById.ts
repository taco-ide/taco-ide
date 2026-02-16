import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  user,
  challengeTeachingAssistant,
  teachingAssistant,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ChallengeParamsSchema = z.object({
  id: z.string().uuid(),
});

const TeachingAssistantItemSchema = z.object({
  id: z.string(),
  alias: z.string(),
  isDefault: z.boolean(),
});

const GetChallengeResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    difficulty: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    supportMaterials: z.unknown().nullable(),
    author: z.string().nullable(),
    classroomTitle: z.string().nullable(),
    teachingAssistants: z.array(TeachingAssistantItemSchema),
    createdAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function getChallengeByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ChallengeParamsSchema>;
  }>(
    "/:id",
    {
      schema: {
        tags: ["challenges"],
        summary: "Get challenge by ID",
        description: "Returns a single challenge with its teaching assistants",
        params: ChallengeParamsSchema,
        response: {
          200: GetChallengeResponseSchema,
          401: ResponseSchema401,
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

      const { id } = request.params;

      const result = await db
        .select({
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          tags: challenge.tags,
          supportMaterials: challenge.supportMaterials,
          createdAt: challenge.createdAt,
          authorName: user.name,
          classroomTitle: classroom.title,
        })
        .from(challenge)
        .leftJoin(classroom, eq(challenge.classroomId, classroom.id))
        .leftJoin(user, eq(challenge.createdByUserId, user.id))
        .where(and(eq(challenge.id, id), isNull(challenge.deletedAt)))
        .limit(1);

      const ch = result[0];
      if (!ch) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const tas = await db
        .select({
          id: teachingAssistant.id,
          alias: teachingAssistant.alias,
          isDefault: challengeTeachingAssistant.isDefault,
        })
        .from(challengeTeachingAssistant)
        .innerJoin(
          teachingAssistant,
          eq(challengeTeachingAssistant.teachingAssistantId, teachingAssistant.id)
        )
        .where(eq(challengeTeachingAssistant.challengeId, id))
        .orderBy(desc(challengeTeachingAssistant.isDefault));

      return reply.status(200).send({
        success: true as const,
        data: {
          id: ch.id,
          title: ch.title,
          description: ch.description,
          difficulty: ch.difficulty,
          tags: ch.tags ?? [],
          supportMaterials: ch.supportMaterials ?? null,
          author: ch.authorName ?? null,
          classroomTitle: ch.classroomTitle ?? null,
          teachingAssistants: tas.map((t) => ({
            id: t.id,
            alias: t.alias,
            isDefault: t.isDefault,
          })),
          createdAt: ch.createdAt.toISOString(),
        },
      });
    }
  );
}
