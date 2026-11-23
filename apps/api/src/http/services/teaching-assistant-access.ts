import { and, asc, count, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { hasMinimumRole, roleHasPermission } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeTeachingAssistant,
  classroom,
  organization,
  teachingAssistant,
  workSession,
} from "@repo/infra/db/schema";
import {
  getMembershipRole,
  type AccessDenied,
  type AccessOk,
  type AuthUser,
} from "./work-session-access";

export type TeachingAssistantAction = "read" | "create" | "update" | "delete";

type Tx = Pick<typeof db, "select" | "insert" | "update" | "delete">;

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
        and(
          eq(organization.id, organizationId),
          eq(organization.isActive, true)
        )
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
    .where(
      and(eq(teachingAssistant.id, id), isNull(teachingAssistant.deletedAt))
    )
    .limit(1);
  return row ?? null;
}

/**
 * Resolves a teaching assistant that a challenge in `organizationId` may use:
 * it must exist, not be deleted, be active and belong to the same organization.
 * Inside a transaction, pass `tx` to lock the row (FOR SHARE) so a concurrent
 * delete cannot slip in between this check and the link insert.
 */
export async function findAssignableTeachingAssistant(
  id: string,
  organizationId: string,
  tx?: Tx
) {
  const query = (tx ?? db)
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
  const [row] = tx ? await query.for("share") : await query;
  return row ?? null;
}

/** The organization's default assistant: its oldest active, non-deleted one. */
export async function findDefaultTeachingAssistant(organizationId: string) {
  const [row] = await db
    .select({
      id: teachingAssistant.id,
      createdAt: teachingAssistant.createdAt,
    })
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

export async function isOrganizationDefault(ta: {
  id: string;
  createdByOrganizationId: string | null;
}) {
  if (!ta.createdByOrganizationId) return false;
  const current = await findDefaultTeachingAssistant(
    ta.createdByOrganizationId
  );
  return current?.id === ta.id;
}

/** Non-deleted challenges currently linked to the teaching assistant. */
export async function listActiveLinkedChallenges(teachingAssistantId: string) {
  return db
    .select({ id: challenge.id, title: challenge.title })
    .from(challengeTeachingAssistant)
    .innerJoin(
      challenge,
      eq(challenge.id, challengeTeachingAssistant.challengeId)
    )
    .where(
      and(
        eq(challengeTeachingAssistant.teachingAssistantId, teachingAssistantId),
        isNull(challenge.deletedAt)
      )
    )
    .orderBy(asc(challenge.title));
}

/**
 * Non-deleted challenges that depend on the teaching assistant: linked to it,
 * or with work sessions (in progress or submitted, which can be reopened)
 * whose chat runs on it.
 */
export async function listChallengesUsingTeachingAssistant(
  teachingAssistantId: string,
  tx: Pick<typeof db, "select"> = db
) {
  const linked = tx
    .select({ id: challengeTeachingAssistant.challengeId })
    .from(challengeTeachingAssistant)
    .where(
      eq(challengeTeachingAssistant.teachingAssistantId, teachingAssistantId)
    );
  const withSessions = tx
    .select({ id: workSession.challengeId })
    .from(workSession)
    .where(eq(workSession.teachingAssistantId, teachingAssistantId));
  return tx
    .select({
      id: challenge.id,
      title: challenge.title,
      createdByUserId: challenge.createdByUserId,
      classroomTeacherUserId: classroom.teacherUserId,
    })
    .from(challenge)
    .leftJoin(classroom, eq(classroom.id, challenge.classroomId))
    .where(
      and(
        isNull(challenge.deletedAt),
        or(inArray(challenge.id, linked), inArray(challenge.id, withSessions))
      )
    )
    .orderBy(asc(challenge.title));
}

/**
 * Teachers may only change assistants nobody else depends on. Coordinators,
 * admins and platform admins may change any assistant of their organization.
 * A teacher is refused when the assistant
 *   - is the organization default (used by every challenge without a
 *     chosen assistant), or would become it by being activated; or
 *   - serves a challenge the teacher neither created nor leads the
 *     classroom of.
 * Call after `assertCanAccessTeachingAssistantOrg(..., "update")`.
 */
export async function assertCanChangeSharedTeachingAssistant(
  usr: AuthUser,
  ta: {
    id: string;
    createdAt: Date;
    isActive: boolean;
    createdByOrganizationId: string | null;
  },
  activating: boolean
): Promise<AccessOk | AccessDenied> {
  if (usr.isPlatformAdmin || !ta.createdByOrganizationId) return { ok: true };
  const role = await getMembershipRole(usr.id, ta.createdByOrganizationId);
  if (role && hasMinimumRole(role, "coordinator")) return { ok: true };

  const current = await findDefaultTeachingAssistant(
    ta.createdByOrganizationId
  );
  const becomesDefault =
    activating &&
    !ta.isActive &&
    (!current ||
      ta.createdAt < current.createdAt ||
      (ta.createdAt.getTime() === current.createdAt.getTime() &&
        ta.id < current.id));
  if (current?.id === ta.id || becomesDefault)
    return {
      ok: false,
      status: 403,
      message:
        "Only coordinators and admins can change the organization's default teaching assistant",
    };

  const users = await listChallengesUsingTeachingAssistant(ta.id);
  const foreign = users.filter(
    (c) => c.createdByUserId !== usr.id && c.classroomTeacherUserId !== usr.id
  );
  if (foreign.length > 0)
    return {
      ok: false,
      status: 403,
      message:
        "This teaching assistant is used by challenges you do not manage. Ask a coordinator or admin to change it.",
    };
  return { ok: true };
}

/**
 * Replaces a challenge's teaching assistant (`null` = organization default)
 * and moves every work session of the challenge to the assistant it will use
 * from now on, so students keep chatting even if the old one is later
 * deactivated or deleted. `sessionTeachingAssistantId` is the assistant the
 * sessions must use (the new one, or the organization default); when null,
 * sessions are left untouched.
 */
export async function replaceChallengeTeachingAssistant(
  tx: Tx,
  challengeId: string,
  teachingAssistantId: string | null,
  sessionTeachingAssistantId: string | null
) {
  await tx
    .delete(challengeTeachingAssistant)
    .where(eq(challengeTeachingAssistant.challengeId, challengeId));
  if (teachingAssistantId)
    await tx.insert(challengeTeachingAssistant).values({
      challengeId,
      teachingAssistantId,
      isDefault: true,
    });
  if (sessionTeachingAssistantId)
    await tx
      .update(workSession)
      .set({
        teachingAssistantId: sessionTeachingAssistantId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workSession.challengeId, challengeId),
          ne(workSession.teachingAssistantId, sessionTeachingAssistantId)
        )
      );
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
    .innerJoin(
      challenge,
      eq(challenge.id, challengeTeachingAssistant.challengeId)
    )
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
