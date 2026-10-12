import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { knowledgeBase, classroom } from "@repo/infra/db/schema";
import {
  assertCanAccessClassroom,
  classroomReadCondition,
  getMembershipRole,
  loadClassroomAccessContext,
  type AuthUser,
  type AccessDenied,
} from "./work-session-access";

type KnowledgeBaseAccess =
  | { ok: true; knowledgeBase: typeof knowledgeBase.$inferSelect }
  | AccessDenied;

/** Authorize the current parent classroom before exposing or modifying KB content. */
export async function assertKnowledgeBaseResourceAccess(
  usr: AuthUser,
  kbId: string,
  mode: "read" | "manage" = "read"
): Promise<KnowledgeBaseAccess> {
  const [kb] = await db
    .select()
    .from(knowledgeBase)
    .where(and(eq(knowledgeBase.id, kbId), isNull(knowledgeBase.deletedAt)))
    .limit(1);
  const cls = kb ? await loadClassroomAccessContext(kb.classroomId) : null;
  if (!kb || !cls || kb.organizationId !== cls.organizationId) {
    return { ok: false, status: 404, message: "Knowledge base not found" };
  }
  const access = await assertCanAccessClassroom(usr, cls, mode);
  if (access.ok) return { ok: true, knowledgeBase: kb };
  if (
    kb.createdByUserId === usr.id &&
    (await getMembershipRole(usr.id, cls.organizationId)) === "teacher"
  ) {
    return { ok: true, knowledgeBase: kb };
  }
  return {
    ok: false,
    status: 403,
    message: "You cannot access this knowledge base",
  };
}

export function knowledgeBaseReadCondition(usr: AuthUser) {
  return sql`${knowledgeBase.deletedAt} is null and exists (
    select 1 from ${classroom} where ${classroom.id} = ${knowledgeBase.classroomId}
      and ${classroom.organizationId} = ${knowledgeBase.organizationId}
      and ${classroomReadCondition(usr, knowledgeBase.createdByUserId)})`;
}
