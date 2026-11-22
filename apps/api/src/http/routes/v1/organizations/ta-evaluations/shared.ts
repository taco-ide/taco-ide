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
 */
import { z } from "zod";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@repo/infra/db";
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
 */
export async function assertCanReadOrgEvaluations(
  usr: AuthUser,
  organizationId: string
): Promise<{ ok: true } | Denied> {
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(
      and(eq(organization.id, organizationId), eq(organization.isActive, true))
    )
    .limit(1);
  if (!org) {
    return { ok: false, status: 404, message: "Organization not found" };
  }
  if (usr.isPlatformAdmin) return { ok: true };

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
