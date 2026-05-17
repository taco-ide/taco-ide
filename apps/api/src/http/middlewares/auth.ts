import { FastifyReply, FastifyRequest } from "fastify";
import { auth, isValidRole } from "@repo/infra/auth";
import type { RoleName } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { user, member, organization } from "@repo/infra/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Convert Fastify headers to Web API Headers
    const headersObj = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headersObj.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => headersObj.append(key, v));
      }
    }

    // Validate session with Better Auth
    const session = await auth.api.getSession({ headers: headersObj });

    if (!session?.user) {
      return reply.status(401).send({
        success: false,
        message: "Invalid or expired session",
      });
    }

    // Get additional user data
    const userData = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        isPlatformAdmin: user.isPlatformAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData[0] || !userData[0].isActive) {
      return reply.status(403).send({
        success: false,
        message: "User account is disabled",
      });
    }

    // Resolve role and org name from active organization.
    //
    // session.activeOrganizationId is the source of truth, but it can point to
    // a deactivated org (Better Auth doesn't enforce this) or be NULL right
    // after login / after the platform admin deactivates the user's org
    // (setActive route clears matching sessions). In both cases we fall back
    // to the user's oldest membership whose org is still active, so the UI
    // never lands in a "ghost" state where /me returns a deactivated org.
    let activeOrgId = session.session.activeOrganizationId ?? null;
    let role: RoleName | null = null;
    let activeOrgName: string | null = null;

    // If the session points to an org, ensure it's still active. If it's not,
    // treat it as if no active org was set so we can fall back to a healthy
    // membership below.
    if (activeOrgId) {
      const orgRow = await db
        .select({ id: organization.id, isActive: organization.isActive })
        .from(organization)
        .where(eq(organization.id, activeOrgId))
        .limit(1);
      if (!orgRow[0] || !orgRow[0].isActive) {
        activeOrgId = null;
      }
    }

    // No active org (or it pointed to a deactivated one): pick the oldest
    // membership belonging to an active org. orderBy is required for
    // deterministic behavior when the user has multiple memberships.
    if (!activeOrgId) {
      const firstActiveMembership = await db
        .select({ orgId: member.organizationId })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(
          and(
            eq(member.userId, session.user.id),
            eq(organization.isActive, true)
          )
        )
        .orderBy(asc(member.createdAt))
        .limit(1);

      if (firstActiveMembership[0]) {
        activeOrgId = firstActiveMembership[0].orgId;
      }
    }

    if (activeOrgId) {
      const memberData = await db
        .select({
          memberId: member.id,
          role: member.role,
          orgName: organization.name,
          lastActiveAt: member.lastActiveAt,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(
          and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId),
            eq(organization.isActive, true)
          )
        )
        .limit(1);

      if (memberData[0]) {
        if (isValidRole(memberData[0].role)) {
          role = memberData[0].role;
        }
        activeOrgName = memberData[0].orgName;

        // Debounced bump of member.lastActiveAt: only update if null or older
        // than 5 minutes. Fire-and-forget; failure must not block the request.
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const last = memberData[0].lastActiveAt;
        if (!last || last.getTime() < fiveMinutesAgo) {
          db.update(member)
            .set({ lastActiveAt: new Date() })
            .where(eq(member.id, memberData[0].memberId))
            .catch((err) => {
              console.error("Failed to bump member.lastActiveAt:", err);
            });
        }
      }
    }

    // Attach user to request
    request.user = {
      id: userData[0].id,
      email: userData[0].email,
      name: userData[0].name,
      image: userData[0].image,
      emailVerified: userData[0].emailVerified,
      isActive: userData[0].isActive,
      isPlatformAdmin: userData[0].isPlatformAdmin,
      createdAt: userData[0].createdAt,
      updatedAt: userData[0].updatedAt,
      activeOrganizationId: activeOrgId,
      activeOrganizationName: activeOrgName,
      role,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return reply.status(401).send({
      success: false,
      message: "Session token invalid or expired",
    });
  }
}
