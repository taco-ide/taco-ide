import { challengeReadCondition } from "../../../services/work-session-access";
import { z } from "zod";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema401 } from "../../_responses/types";
import { db } from "@repo/infra/db";
import { challenge, classroom, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListChallengesQuerySchema = z
  .object({
    scope: z.enum(["mine", "public", "all"]).default("all"),
    classroomId: z.string().min(1).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    tags: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    perPage: z.coerce.number().min(1).max(100).default(20),
  })
  .strict();

const ChallengeItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  author: z.string().nullable(),
  classroomTitle: z.string().nullable(),
  createdAt: z.string(),
});

const ListChallengesResponseSchema = ResponseSchema200.extend({
  data: z.array(ChallengeItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listChallengesRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof ListChallengesQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["challenges"],
        summary: "List challenges",
        description:
          "List challenges. scope=mine: from user's classrooms; scope=public: unassigned (no classroom); scope=all: both. classroomId: filter by specific classroom.",
        querystring: ListChallengesQuerySchema,
        response: {
          200: ListChallengesResponseSchema,
          401: ResponseSchema401,
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

      const { scope, classroomId, difficulty, tags, page, perPage } =
        request.query;
      const tagsArray = tags ? tags.split(",").map((t) => t.trim()) : undefined;
      const offset = (page - 1) * perPage;

      const conditions = [challengeReadCondition(usr)];

      if (classroomId) conditions.push(eq(challenge.classroomId, classroomId));
      if (scope === "public") conditions.push(isNull(challenge.classroomId));
      if (scope === "mine")
        conditions.push(sql`${challenge.classroomId} is not null`);
      if (tagsArray && tagsArray.length > 0) {
        conditions.push(
          sql`${challenge.tags} ?| ARRAY[${sql.join(
            tagsArray.map((tag) => sql`${tag}`),
            sql`, `
          )}]::text[]`
        );
      }

      if (difficulty) {
        conditions.push(eq(challenge.difficulty, difficulty));
      }

      const whereClause = and(...conditions);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(challenge)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const challenges = await db
        .select({
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          tags: challenge.tags,
          createdAt: challenge.createdAt,
          authorName: user.name,
          classroomTitle: classroom.title,
        })
        .from(challenge)
        .leftJoin(classroom, eq(challenge.classroomId, classroom.id))
        .leftJoin(user, eq(challenge.createdByUserId, user.id))
        .where(whereClause)
        .orderBy(desc(challenge.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: challenges.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          tags: c.tags ?? [],
          author: c.authorName ?? null,
          classroomTitle: c.classroomTitle ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
