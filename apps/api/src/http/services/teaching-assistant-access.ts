import { and, asc, count, eq, isNull } from "drizzle-orm";
import { hasMinimumRole, roleHasPermission } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeTeachingAssistant,
  organization,
  teachingAssistant,
} from "@repo/infra/db/schema";
import {
  getMembershipRole,
  type AccessDenied,
  type AccessOk,
  type AuthUser,
} from "./work-session-access";

export type TeachingAssistantAction = "read" | "create" | "update" | "delete";

/**
 * Teaching assistants belong to the organization in
 * `createdByOrganizationId`. Access is evaluated against that organization
 * (never the caller's active organization alone):
 *   - platform admins: any active organization;
 *   - read: teacher, coordinator or admin of the organization (students
 *     never see system prompts);
 *   - create/update/delete: the `teachingAssistant` permission statements of
 *     the caller's role in the organization.
 */
export async function assertCanAccessTeachingAssistantOrg(
  usr: AuthUser,
  organizationId: string | null,
  action: TeachingAssistantAction
): Promise<AccessOk | AccessDenied> {
  if (!organizationId)
    return {
      ok: false,
      status: 403,
      message: "This teaching assistant is not managed by an organization",
    };

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

  const role = await getMembershipRole(usr.id, organizationId);
  const allowed =
    !!role &&
    (action === "read"
      ? hasMinimumRole(role, "teacher")
      : roleHasPermission(role, "teachingAssistant", action));
  if (allowed) return { ok: true };
  return {
    ok: false,
    status: 403,
    message:
      action === "read"
        ? "You cannot access teaching assistants of this organization"
        : `Missing permission: ${action} on teachingAssistant in this organization`,
  };
}

/** Loads a non-deleted teaching assistant. */
export async function loadTeachingAssistant(id: string) {
  const [row] = await db
    .select()
    .from(teachingAssistant)
    .where(and(eq(teachingAssistant.id, id), isNull(teachingAssistant.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Resolves a teaching assistant that a challenge in `organizationId` may use:
 * it must exist, not be deleted, be active and belong to the same organization.
 */
export async function findAssignableTeachingAssistant(
  id: string,
  organizationId: string
) {
  const [row] = await db
    .select({ id: teachingAssistant.id })
    .from(teachingAssistant)
    .where(
      and(
        eq(teachingAssistant.id, id),
        eq(teachingAssistant.createdByOrganizationId, organizationId),
        eq(teachingAssistant.isActive, true),
        isNull(teachingAssistant.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

/** The organization's default assistant: its oldest active, non-deleted one. */
export async function findDefaultTeachingAssistant(organizationId: string) {
  const [row] = await db
    .select({ id: teachingAssistant.id })
    .from(teachingAssistant)
    .where(
      and(
        eq(teachingAssistant.createdByOrganizationId, organizationId),
        eq(teachingAssistant.isActive, true),
        isNull(teachingAssistant.deletedAt)
      )
    )
    .orderBy(asc(teachingAssistant.createdAt), asc(teachingAssistant.id))
    .limit(1);
  return row ?? null;
}

/** Non-deleted challenges currently linked to the teaching assistant. */
export async function listActiveLinkedChallenges(teachingAssistantId: string) {
  return db
    .select({ id: challenge.id, title: challenge.title })
    .from(challengeTeachingAssistant)
    .innerJoin(challenge, eq(challenge.id, challengeTeachingAssistant.challengeId))
    .where(
      and(
        eq(challengeTeachingAssistant.teachingAssistantId, teachingAssistantId),
        isNull(challenge.deletedAt)
      )
    )
    .orderBy(asc(challenge.title));
}

/** Active-challenge link counts per teaching assistant id. */
export async function countActiveLinkedChallenges(
  organizationId: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      teachingAssistantId: challengeTeachingAssistant.teachingAssistantId,
      total: count(),
    })
    .from(challengeTeachingAssistant)
    .innerJoin(challenge, eq(challenge.id, challengeTeachingAssistant.challengeId))
    .innerJoin(
      teachingAssistant,
      eq(teachingAssistant.id, challengeTeachingAssistant.teachingAssistantId)
    )
    .where(
      and(
        eq(teachingAssistant.createdByOrganizationId, organizationId),
        isNull(challenge.deletedAt)
      )
    )
    .groupBy(challengeTeachingAssistant.teachingAssistantId);
  return new Map(rows.map((r) => [r.teachingAssistantId, Number(r.total)]));
}
