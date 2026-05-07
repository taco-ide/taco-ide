import { eq, and, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { RoleName } from "@repo/infra/auth";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  member,
  userClassroom,
} from "@repo/infra/db/schema";

type AuthUser = NonNullable<FastifyRequest["user"]>;

export type AccessDenied = {
  ok: false;
  status: 403 | 404;
  message: string;
};

export type AccessOk = { ok: true };

/** Map Better Auth organization member labels to app RoleName */
export function normalizeOrgMemberRole(dbRole: string): RoleName | null {
  if (isValidRole(dbRole)) return dbRole;
  if (dbRole === "owner") return "admin";
  if (dbRole === "member") return "student";
  return null;
}

type ChallengeCtx = {
  challengeId: string;
  classroomId: string | null;
  createdByUserId: string | null;
  organizationId: string | null;
  classroomTeacherUserId: string | null;
};

export async function loadChallengeWorkAccessContext(
  challengeId: string
): Promise<ChallengeCtx | null> {
  const [ch] = await db
    .select({
      id: challenge.id,
      classroomId: challenge.classroomId,
      createdByUserId: challenge.createdByUserId,
    })
    .from(challenge)
    .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
    .limit(1);

  if (!ch) return null;

  if (!ch.classroomId) {
    return {
      challengeId: ch.id,
      classroomId: null,
      createdByUserId: ch.createdByUserId,
      organizationId: null,
      classroomTeacherUserId: null,
    };
  }

  const [cls] = await db
    .select({
      organizationId: classroom.organizationId,
      teacherUserId: classroom.teacherUserId,
    })
    .from(classroom)
    .where(and(eq(classroom.id, ch.classroomId), isNull(classroom.deletedAt)))
    .limit(1);

  if (!cls) {
    return null;
  }

  return {
    challengeId: ch.id,
    classroomId: ch.classroomId,
    createdByUserId: ch.createdByUserId,
    organizationId: cls.organizationId,
    classroomTeacherUserId: cls.teacherUserId,
  };
}

async function getMembershipRole(
  userId: string,
  organizationId: string
): Promise<RoleName | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);
  if (!row) return null;
  return normalizeOrgMemberRole(row.role);
}

async function isEnrolledInClassroom(
  userId: string,
  classroomId: string
): Promise<boolean> {
  const [row] = await db
    .select({ userId: userClassroom.userId })
    .from(userClassroom)
    .where(
      and(
        eq(userClassroom.userId, userId),
        eq(userClassroom.classroomId, classroomId),
        isNull(userClassroom.deletedAt)
      )
    )
    .limit(1);
  return !!row;
}

/**
 * User may create/use their own work session on this challenge (student flow).
 */
export async function assertCanParticipateInChallengeWorkSession(
  usr: AuthUser,
  ctx: ChallengeCtx
): Promise<AccessOk | AccessDenied> {
  if (!ctx.classroomId) {
    // Public / unassigned challenge: any authenticated user may practice.
    return { ok: true };
  }

  if (!ctx.organizationId) {
    return {
      ok: false,
      status: 403,
      message: "Challenge classroom is not available",
    };
  }

  const orgRole = await getMembershipRole(usr.id, ctx.organizationId);
  if (!orgRole) {
    return {
      ok: false,
      status: 403,
      message: "You are not a member of this challenge's organization",
    };
  }

  if (orgRole === "coordinator" || orgRole === "admin") {
    return { ok: true };
  }

  if (orgRole === "teacher") {
    const isLead =
      ctx.classroomTeacherUserId === usr.id ||
      ctx.createdByUserId === usr.id;
    if (isLead) return { ok: true };
    const enrolled = await isEnrolledInClassroom(usr.id, ctx.classroomId);
    if (enrolled) return { ok: true };
    return {
      ok: false,
      status: 403,
      message: "You are not assigned to this classroom or challenge",
    };
  }

  // student (and mapped "member")
  const enrolled = await isEnrolledInClassroom(usr.id, ctx.classroomId);
  if (!enrolled) {
    return {
      ok: false,
      status: 403,
      message: "You must be enrolled in this classroom to access this challenge",
    };
  }

  return { ok: true };
}

/**
 * Teacher/coordinator/admin may view or mutate a student's session for this challenge.
 */
export async function assertStaffCanAccessChallengeWorkSessions(
  usr: AuthUser,
  ctx: ChallengeCtx,
  _mode: "read" | "mutate"
): Promise<AccessOk | AccessDenied> {
  if (!ctx.classroomId || !ctx.organizationId) {
    if (ctx.createdByUserId !== usr.id) {
      return {
        ok: false,
        status: 403,
        message: "You can only manage work sessions for challenges you created",
      };
    }
    if (!usr.activeOrganizationId) {
      return {
        ok: false,
        status: 403,
        message: "No active organization selected",
      };
    }
    const activeOrgRole = await getMembershipRole(
      usr.id,
      usr.activeOrganizationId
    );
    if (!activeOrgRole || !hasMinimumRole(activeOrgRole, "teacher")) {
      return {
        ok: false,
        status: 403,
        message: "Insufficient permissions",
      };
    }
    return { ok: true };
  }

  const orgRole = await getMembershipRole(usr.id, ctx.organizationId);
  if (!orgRole) {
    return {
      ok: false,
      status: 403,
      message: "You are not a member of this challenge's organization",
    };
  }

  if (!hasMinimumRole(orgRole, "teacher")) {
    return {
      ok: false,
      status: 403,
      message: "Only teachers and above can access student work sessions",
    };
  }

  if (orgRole === "coordinator" || orgRole === "admin") {
    return { ok: true };
  }

  // teacher in org: must own the challenge or lead the classroom
  const isLead =
    ctx.classroomTeacherUserId === usr.id || ctx.createdByUserId === usr.id;
  if (!isLead) {
    return {
      ok: false,
      status: 403,
      message: "You can only manage work sessions for your own challenges",
    };
  }

  return { ok: true };
}

/**
 * List work sessions for a challenge: coordinator/admin limited to their org's challenges.
 */
export async function assertCanListChallengeWorkSessions(
  usr: AuthUser,
  ctx: ChallengeCtx
): Promise<AccessOk | AccessDenied> {
  if (!ctx.classroomId || !ctx.organizationId) {
    if (ctx.createdByUserId !== usr.id) {
      return {
        ok: false,
        status: 403,
        message: "You can only view work sessions for your own challenges",
      };
    }
    if (!usr.activeOrganizationId) {
      return {
        ok: false,
        status: 403,
        message: "No active organization selected",
      };
    }
    const activeOrgRole = await getMembershipRole(
      usr.id,
      usr.activeOrganizationId
    );
    if (!activeOrgRole || !hasMinimumRole(activeOrgRole, "teacher")) {
      return {
        ok: false,
        status: 403,
        message: "Insufficient permissions",
      };
    }
    return { ok: true };
  }

  const orgRole = await getMembershipRole(usr.id, ctx.organizationId);
  if (!orgRole) {
    return {
      ok: false,
      status: 403,
      message: "You are not a member of this challenge's organization",
    };
  }

  if (orgRole === "teacher") {
    if (ctx.createdByUserId !== usr.id) {
      return {
        ok: false,
        status: 403,
        message: "You can only view work sessions for your own challenges",
      };
    }
    return { ok: true };
  }

  if (orgRole === "coordinator" || orgRole === "admin") {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message: "You cannot list work sessions for this challenge",
  };
}
