import { z } from "zod";
import {
  eq,
  and,
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
import { workSession, user, challengeSolution } from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
} from "../../../../services/work-session-access";
import {
  deriveWorkSessionStatus,
  inactivityCutoff,
  inactivityThresholdHours,
  inactivityThresholdMs,
  lastActivityAtSql,
  workSessionActivityStatuses,
  workSessionSolutionJoin,
  workSessionStatusFilter,
} from "../../../../services/work-session-activity";

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
  /** Derived activity status; `submitted` is equivalent to `submittedOnly=true`. */
  activityStatus: z.enum(workSessionActivityStatuses).optional(),
  search: z.string().optional(),
});

const WorkSessionRowSchema = z.object({
  workSessionId: z.string(),
  studentUserId: z.string(),
  studentName: z.string(),
  createdAt: z.string(),
  lastMessageAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  /** Latest activity: session start, chat, code run, solution save or staff reopen. */
  lastActivityAt: z.string(),
  activityStatus: z.enum(workSessionActivityStatuses),
});

const ListWorkSessionsResponseSchema = ResponseSchema200.extend({
  data: z.array(WorkSessionRowSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
  /** Hours without activity after which an open session is `inactive`. */
  inactivityThresholdHours: z.number(),
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
          "Paginated list of student work sessions for a challenge, each with a derived activity status (active, inactive after inactivityThresholdHours (WORK_SESSION_INACTIVITY_HOURS) without student activity or a staff reopen, or submitted). Scoped to the challenge's organization: teachers see only their own challenges; coordinators and admins see sessions in their org.",
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
      const { page, perPage, submittedOnly, activityStatus, search } = request.query;
      const offset = (page - 1) * perPage;

      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const listAccess = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!listAccess.ok) {
        return reply.status(listAccess.status).send({
          success: false as const,
          message: listAccess.message,
        });
      }

      const now = new Date();
      const thresholdMs = inactivityThresholdMs();

      const sessionFilters = [eq(workSession.challengeId, challengeId)];

      if (submittedOnly) {
        sessionFilters.push(isNotNull(workSession.endedAt));
      }

      if (activityStatus) {
        sessionFilters.push(
          workSessionStatusFilter(activityStatus, inactivityCutoff(now, thresholdMs))
        );
      }

      const nameSearch = search ? sanitizeNameSearch(search) : "";
      if (nameSearch.length > 0) {
        sessionFilters.push(ilike(user.name, `%${nameSearch}%`));
      }

      const whereSessions = and(...sessionFilters);

      // The solution join is only needed when filtering on last activity.
      const countBase = db
        .select({ count: sql<number>`count(*)::int` })
        .from(workSession)
        .innerJoin(user, eq(workSession.userId, user.id));
      const countResult = await (
        activityStatus === "active" || activityStatus === "inactive"
          ? countBase.leftJoin(challengeSolution, workSessionSolutionJoin)
          : countBase
      ).where(whereSessions);

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
          lastActivityAt: lastActivityAtSql,
        })
        .from(workSession)
        .innerJoin(user, eq(workSession.userId, user.id))
        .leftJoin(challengeSolution, workSessionSolutionJoin)
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
          lastActivityAt: r.lastActivityAt.toISOString(),
          activityStatus: deriveWorkSessionStatus(r, now, thresholdMs),
        })),
        pagination: { total, page, perPage, totalPages },
        inactivityThresholdHours: inactivityThresholdHours(),
      });
    }
  );
}
