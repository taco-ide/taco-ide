import { eq, and, isNull, sql, type SQL } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { RoleName } from "@repo/infra/auth";
import { isValidRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  challenge,
  classroom,
  member,
  organization,
  user,
  userClassroom,
} from "@repo/infra/db/schema";

export type AuthUser = NonNullable<FastifyRequest["user"]>;
export type AccessDenied = { ok: false; status: 403 | 404; message: string };
export type AccessOk = { ok: true };
export type ClassroomCtx = {
  id: string;
  organizationId: string;
  teacherUserId: string | null;
};
export type ChallengeCtx = {
  challengeId: string;
  classroomId: string | null;
  createdByUserId: string | null;
  organizationId: string | null;
  classroomTeacherUserId: string | null;
};

export function normalizeOrgMemberRole(dbRole: string): RoleName | null {
  if (isValidRole(dbRole)) return dbRole;
  if (dbRole === "owner") return "admin";
  if (dbRole === "member") return "student";
  return null;
}

export async function getMembershipRole(
  userId: string,
  organizationId: string
): Promise<RoleName | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
        eq(organization.isActive, true),
        eq(user.isActive, true),
        isNull(user.deletedAt)
      )
    )
    .limit(1);
  return row ? normalizeOrgMemberRole(row.role) : null;
}

export async function loadClassroomAccessContext(
  classroomId: string
): Promise<ClassroomCtx | null> {
  const [row] = await db
    .select({
      id: classroom.id,
      organizationId: classroom.organizationId,
      teacherUserId: classroom.teacherUserId,
    })
    .from(classroom)
    .innerJoin(organization, eq(organization.id, classroom.organizationId))
    .where(
      and(
        eq(classroom.id, classroomId),
        isNull(classroom.deletedAt),
        eq(organization.isActive, true)
      )
    )
    .limit(1);
  return row ?? null;
}

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
  const cls = ch.classroomId
    ? await loadClassroomAccessContext(ch.classroomId)
    : null;
  if (ch.classroomId && !cls) return null;
  return {
    challengeId: ch.id,
    classroomId: ch.classroomId,
    createdByUserId: ch.createdByUserId,
    organizationId: cls?.organizationId ?? null,
    classroomTeacherUserId: cls?.teacherUserId ?? null,
  };
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

export async function assertCanAccessClassroom(
  usr: AuthUser,
  ctx: ClassroomCtx,
  mode: "read" | "manage" | "coordinate" = "read"
): Promise<AccessOk | AccessDenied> {
  if (usr.isPlatformAdmin) return { ok: true };
  const role = await getMembershipRole(usr.id, ctx.organizationId);
  if (role === "coordinator" || role === "admin") return { ok: true };
  if (
    mode !== "coordinate" &&
    role === "teacher" &&
    ctx.teacherUserId === usr.id
  )
    return { ok: true };
  if (mode === "read" && role && (await isEnrolledInClassroom(usr.id, ctx.id)))
    return { ok: true };
  return {
    ok: false,
    status: 403,
    message: "You cannot access this classroom",
  };
}

export async function assertCanParticipateInChallengeWorkSession(
  usr: AuthUser,
  ctx: ChallengeCtx
): Promise<AccessOk | AccessDenied> {
  if (!ctx.classroomId) return { ok: true };
  if (!ctx.organizationId)
    return {
      ok: false,
      status: 403,
      message: "Challenge classroom is not available",
    };
  if (usr.isPlatformAdmin) return { ok: true };
  const role = await getMembershipRole(usr.id, ctx.organizationId);
  if (role === "admin" || role === "coordinator") return { ok: true };
  if (
    role === "teacher" &&
    (ctx.createdByUserId === usr.id || ctx.classroomTeacherUserId === usr.id)
  )
    return { ok: true };
  if (role && (await isEnrolledInClassroom(usr.id, ctx.classroomId)))
    return { ok: true };
  return {
    ok: false,
    status: 403,
    message: "You are not assigned to this classroom or challenge",
  };
}

export async function assertCanListChallengeWorkSessions(
  usr: AuthUser,
  ctx: ChallengeCtx
): Promise<AccessOk | AccessDenied> {
  if (usr.isPlatformAdmin) return { ok: true };
  if (!ctx.classroomId) {
    return ctx.createdByUserId === usr.id
      ? { ok: true }
      : {
          ok: false,
          status: 403,
          message: "You can only manage challenges you created",
        };
  }
  const role = ctx.organizationId
    ? await getMembershipRole(usr.id, ctx.organizationId)
    : null;
  if (role === "admin" || role === "coordinator") return { ok: true };
  if (
    role === "teacher" &&
    (ctx.createdByUserId === usr.id || ctx.classroomTeacherUserId === usr.id)
  )
    return { ok: true };
  return {
    ok: false,
    status: 403,
    message: "You cannot manage this challenge",
  };
}

export async function assertStaffCanAccessChallengeWorkSessions(
  usr: AuthUser,
  ctx: ChallengeCtx,
  _mode: "read" | "mutate"
): Promise<AccessOk | AccessDenied> {
  return assertCanListChallengeWorkSessions(usr, ctx);
}

/** Correlated predicates keep pagination/count scoped by the same current access policy. */
export function classroomReadCondition(usr: AuthUser): SQL {
  const participation = usr.isPlatformAdmin
    ? sql`true`
    : sql`exists (
    select 1 from ${member} where ${member.organizationId} = ${classroom.organizationId}
      and ${member.userId} = ${usr.id} and (
        ${member.role} in ('admin', 'owner', 'coordinator') or
        (${member.role} = 'teacher' and ${classroom.teacherUserId} = ${usr.id}) or
        (${member.role} in ('student', 'member', 'teacher') and exists (
          select 1 from ${userClassroom} where ${userClassroom.classroomId} = ${classroom.id}
            and ${userClassroom.userId} = ${usr.id} and ${userClassroom.deletedAt} is null))
      ))`;
  return sql`${classroom.deletedAt} is null and exists (select 1 from ${organization}
    where ${organization.id} = ${classroom.organizationId} and ${organization.isActive} = true) and ${participation}`;
}

export function challengeReadCondition(usr: AuthUser): SQL {
  const creator = usr.isPlatformAdmin
    ? sql`true`
    : sql`exists (select 1 from ${member}
    where ${member.organizationId} = ${classroom.organizationId} and ${member.userId} = ${usr.id}
      and ${member.role} = 'teacher' and ${challenge.createdByUserId} = ${usr.id})`;
  return sql`${challenge.deletedAt} is null and (${challenge.classroomId} is null or exists (
    select 1 from ${classroom} where ${classroom.id} = ${challenge.classroomId}
      and ${classroom.deletedAt} is null and exists (select 1 from ${organization}
        where ${organization.id} = ${classroom.organizationId} and ${organization.isActive} = true)
      and (${classroomReadCondition(usr)} or ${creator})))`;
}
