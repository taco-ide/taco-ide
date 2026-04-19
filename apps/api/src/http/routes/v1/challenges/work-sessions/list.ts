import { z } from "zod";
import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  sql,
  ilike,
} from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requirePermission } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { challenge, workSession, user } from "@repo/infra/db/schema";

const ListWorkSessionsParamsSchema = z.object({
  challengeId: z.string().uuid(),
});

const ListWorkSessionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(50).default(20),
  submittedOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  search: z.string().optional(),
});

const WorkSessionRowSchema = z.object({
  workSessionId: z.string(),
  studentUserId: z.string(),
  studentName: z.string(),
  createdAt: z.string(),
  lastMessageAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});

const ListWorkSessionsResponseSchema = ResponseSchema200.extend({
  data: z.array(WorkSessionRowSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

/** Remove ILIKE wildcards from user input to avoid accidental pattern injection */
function sanitizeNameSearch(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

export async function listChallengeWorkSessionsRoute(
  app: FastifyTypedInstance
) {
  app.get<{
    Params: z.infer<typeof ListWorkSessionsParamsSchema>;
    Querystring: z.infer<typeof ListWorkSessionsQuerySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("challenge", "update")],
      schema: {
        tags: ["challenge-work-sessions"],
        summary: "List work sessions for challenge (staff)",
        description:
          "Paginated list of student work sessions for a challenge. Teachers: own challenges only. Coordinators/admins: any.",
        params: ListWorkSessionsParamsSchema,
        querystring: ListWorkSessionsQuerySchema,
        response: {
          200: ListWorkSessionsResponseSchema,
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
      const { page, perPage, submittedOnly, search } = request.query;
      const offset = (page - 1) * perPage;

      const [ch] = await db
        .select({
          id: challenge.id,
          createdByUserId: challenge.createdByUserId,
        })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      if (usr.role === "teacher" && ch.createdByUserId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "You can only view work sessions for your own challenges",
        });
      }

      const sessionFilters = [eq(workSession.challengeId, challengeId)];

      if (submittedOnly) {
        sessionFilters.push(isNotNull(workSession.endedAt));
      }

      const nameSearch = search ? sanitizeNameSearch(search) : "";
      if (nameSearch.length > 0) {
        sessionFilters.push(ilike(user.name, `%${nameSearch}%`));
      }

      const whereSessions = and(...sessionFilters);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workSession)
        .innerJoin(user, eq(workSession.userId, user.id))
        .where(whereSessions);

      const total = Number(countResult[0]?.count ?? 0);
      const totalPages = Math.ceil(total / perPage) || 0;

      const rows = await db
        .select({
          workSessionId: workSession.id,
          studentUserId: user.id,
          studentName: user.name,
          createdAt: workSession.createdAt,
          lastMessageAt: workSession.lastMessageAt,
          endedAt: workSession.endedAt,
        })
        .from(workSession)
        .innerJoin(user, eq(workSession.userId, user.id))
        .where(whereSessions)
        .orderBy(desc(workSession.createdAt))
        .limit(perPage)
        .offset(offset);

      return reply.status(200).send({
        success: true as const,
        data: rows.map((r) => ({
          workSessionId: r.workSessionId,
          studentUserId: r.studentUserId,
          studentName: r.studentName,
          createdAt: r.createdAt.toISOString(),
          lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
          endedAt: r.endedAt?.toISOString() ?? null,
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
