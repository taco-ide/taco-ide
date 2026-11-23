/**
 * Shared pieces of the anonymous teaching-assistant rating routes (#99).
 *
 * Ratings (`teaching_assistant_evaluation`) only hold the TA id, a 1–5 grade
 * and the ISO week. They are scoped to an organization through the TA's
 * `createdByOrganizationId`: staff see ratings of the TAs their organization
 * owns. Global TAs (no owning organization) are never included, so ratings
 * collected in one organization never surface in another. Nothing here may
 * join ratings to users, work sessions or classrooms — anonymity is a design
 * requirement (#86).
 *
 * Small-cell suppression: the unit of aggregation is the (week × TA) group.
 * Groups with fewer than `TA_RATING_MIN_GROUP_SIZE` (k) ratings are withheld,
 * and every published number (totals, means, distributions, weekly buckets,
 * per-TA rows, CSV rows) is computed only from groups of at least k ratings.
 * Because date filters snap to whole weeks, no combination of filters can
 * isolate fewer than k ratings by differencing two responses.
 */
import { z } from "zod";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { env } from "@repo/infra/env";
import {
  organization,
  teachingAssistant,
  teachingAssistantEvaluation,
} from "@repo/infra/db/schema";
import { getMembershipRole } from "../../../../services/work-session-access";
import type { AuthUser } from "../../../../services/work-session-access";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

export const EvaluationParamsSchema = z.object({
  id: z.string().min(1),
});

export const EvaluationQuerySchema = z
  .object({
    teachingAssistantId: z.string().min(1).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "`from` must be on or before `to`",
    path: ["from"],
  });

export type EvaluationQuery = z.infer<typeof EvaluationQuerySchema>;

export type OrgTeachingAssistant = {
  id: string;
  alias: string;
  version: number;
  isActive: boolean;
};

type Denied = { ok: false; status: 403 | 404; message: string };

/**
 * Staff-only access to an organization's rating data: platform admins, or
 * current teacher/coordinator/admin members of the (active) organization.
 * Membership is checked first so non-members get 403 whether or not the
 * organization exists; only platform admins can tell a missing one (404).
 */
export async function assertCanReadOrgEvaluations(
  usr: AuthUser,
  organizationId: string
): Promise<{ ok: true } | Denied> {
  if (usr.isPlatformAdmin) {
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(
        and(eq(organization.id, organizationId), eq(organization.isActive, true))
      )
      .limit(1);
    return org
      ? { ok: true }
      : { ok: false, status: 404, message: "Organization not found" };
  }

  // getMembershipRole only matches active organizations and active users.
  const role = await getMembershipRole(usr.id, organizationId);
  if (role === "teacher" || role === "coordinator" || role === "admin") {
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    message: "Only staff of this organization can view teaching assistant ratings",
  };
}

export async function listOrgTeachingAssistants(
  organizationId: string
): Promise<OrgTeachingAssistant[]> {
  return db
    .select({
      id: teachingAssistant.id,
      alias: teachingAssistant.alias,
      version: teachingAssistant.version,
      isActive: teachingAssistant.isActive,
    })
    .from(teachingAssistant)
    .where(eq(teachingAssistant.createdByOrganizationId, organizationId))
    .orderBy(teachingAssistant.alias, teachingAssistant.version);
}

/**
 * Date-range predicate on the rating week. A rating is included when its
 * week starts in [start of the week containing `from`, `to`].
 */
export function weekRangeConditions(query: EvaluationQuery): SQL[] {
  const conditions: SQL[] = [];
  if (query.from) {
    conditions.push(
      gte(
        teachingAssistantEvaluation.week,
        sql`date_trunc('week', ${query.from}::date)`
      )
    );
  }
  if (query.to) {
    conditions.push(
      lte(teachingAssistantEvaluation.week, sql`${query.to}::date`)
    );
  }
  return conditions;
}

/** Predicate restricting ratings to TAs owned by the organization. */
export function orgScopeCondition(organizationId: string): SQL {
  return eq(teachingAssistant.createdByOrganizationId, organizationId);
}

export const weekLabel = sql<string>`to_char(${teachingAssistantEvaluation.week}, 'YYYY-MM-DD')`;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== SMALL-CELL SUPPRESSION ====================

export const GRADES = [1, 2, 3, 4, 5] as const;

export function minGroupSize(): number {
  return env.TA_RATING_MIN_GROUP_SIZE;
}

/** Ratings of one TA in one week: the smallest unit ever published. */
export type RatingGroup = {
  week: string;
  teachingAssistantId: string;
  count: number;
  /** Rating counts for grades 1..5. */
  distribution: number[];
};

/**
 * Loads the organization's (week × TA) rating groups within the date range.
 * The TA filter is left to the caller (per-TA rows ignore it).
 */
export async function loadRatingGroups(
  organizationId: string,
  query: EvaluationQuery
): Promise<RatingGroup[]> {
  const rows = await db
    .select({
      week: weekLabel,
      teachingAssistantId: teachingAssistantEvaluation.teachingAssistantId,
      grade: teachingAssistantEvaluation.grade,
      count: sql<number>`count(*)::int`,
    })
    .from(teachingAssistantEvaluation)
    .innerJoin(
      teachingAssistant,
      eq(teachingAssistant.id, teachingAssistantEvaluation.teachingAssistantId)
    )
    .where(and(orgScopeCondition(organizationId), ...weekRangeConditions(query)))
    .groupBy(
      weekLabel,
      teachingAssistantEvaluation.teachingAssistantId,
      teachingAssistantEvaluation.grade
    );

  const groups = new Map<string, RatingGroup>();
  for (const r of rows) {
    const key = `${r.week}|${r.teachingAssistantId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        week: r.week,
        teachingAssistantId: r.teachingAssistantId,
        count: 0,
        distribution: GRADES.map(() => 0),
      };
      groups.set(key, g);
    }
    const i = r.grade - 1;
    if (i >= 0 && i < GRADES.length) {
      g.distribution[i]! += r.count;
      g.count += r.count;
    }
  }
  return [...groups.values()];
}

export type GroupSummary = {
  /** Ratings in visible groups; null when every group was withheld. */
  count: number | null;
  mean: number | null;
  distribution: number[] | null;
  /** Some ratings were withheld (groups smaller than k). */
  suppressed: boolean;
};

/** Aggregates only the groups with at least `k` ratings. */
export function summarizeGroups(groups: RatingGroup[], k: number): GroupSummary {
  let count = 0;
  let sum = 0;
  let suppressed = false;
  const distribution = GRADES.map(() => 0);
  for (const g of groups) {
    if (g.count < k) {
      suppressed = true;
      continue;
    }
    count += g.count;
    g.distribution.forEach((n, i) => {
      distribution[i]! += n;
      sum += n * GRADES[i]!;
    });
  }
  if (count === 0) {
    return suppressed
      ? { count: null, mean: null, distribution: null, suppressed }
      : { count: 0, mean: null, distribution, suppressed };
  }
  return { count, mean: round2(sum / count), distribution, suppressed };
}

const MAX_SERIES_WEEKS = 520;

function weekStartOf(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Every week (Monday, YYYY-MM-DD) of the requested range, so the weekly
 * series has no silent gaps. Missing bounds default to the first rated week
 * and the current week; the end never passes the current week. Empty when
 * there are no ratings at all.
 */
export function weeksInRange(
  query: EvaluationQuery,
  groupWeeks: string[],
  today = new Date()
): string[] {
  if (groupWeeks.length === 0) return [];
  const sorted = [...groupWeeks].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const current = isoDay(weekStartOf(isoDay(today)));
  let start = query.from ? isoDay(weekStartOf(query.from)) : first;
  let end = query.to ? isoDay(weekStartOf(query.to)) : current;
  if (end > current) end = current;
  if (end < last) end = last;

  const WEEK = 7 * 86_400_000;
  const span = (a: string, b: string) =>
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / WEEK;
  // Don't pad an absurdly early `from` with years of empty weeks.
  if (span(start, end) >= MAX_SERIES_WEEKS && start < first) start = first;

  const weeks: string[] = [];
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += WEEK
  ) {
    weeks.push(isoDay(new Date(t)));
  }
  return weeks;
}
