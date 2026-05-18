import { FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  hasMinimumRole,
  isValidRole,
  roleHasPermission,
} from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { member, organization } from "@repo/infra/db/schema";
import type { RoleName, Resource, ActionFor } from "@repo/infra/auth";

/**
 * Middleware that allows only platform admins. The platform admin flag
 * (`user.isPlatformAdmin`) lives outside the per-organization role model and
 * is required for cross-org operations under `/v1/admin/*`.
 */
export function requirePlatformAdmin() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!request.user.isPlatformAdmin) {
      return reply.status(403).send({
        success: false,
        message: "Platform admin access required",
      });
    }
  };
}

/**
 * Middleware factory that checks if the user has at least the specified role
 * in the hierarchy: student < teacher < coordinator < admin
 */
export function requireRole(minimumRole: RoleName) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!request.user.activeOrganizationId || !request.user.role) {
      return reply.status(403).send({
        success: false,
        message: "No active organization selected",
      });
    }

    if (!hasMinimumRole(request.user.role, minimumRole)) {
      return reply.status(403).send({
        success: false,
        message: "Insufficient role permissions",
      });
    }
  };
}

/**
 * Middleware factory that checks if the user's role has a specific permission
 * on a resource via the AccessControl statements
 */
export function requirePermission<R extends Resource>(
  resource: R,
  action: ActionFor<R>
) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!request.user.activeOrganizationId || !request.user.role) {
      return reply.status(403).send({
        success: false,
        message: "No active organization selected",
      });
    }

    if (!roleHasPermission(request.user.role, resource, action)) {
      return reply.status(403).send({
        success: false,
        message: `Missing permission: ${action} on ${resource}`,
      });
    }
  };
}

/**
 * Middleware factory for routes scoped to an organization in the URL params
 * (e.g. `/v1/organizations/:id/...`). Authorizes the request when the user is:
 *   - authenticated, AND
 *   - either a platform admin, or a member of the organization with at least
 *     `minimumRole`.
 *
 * Returns 401 unauthenticated, 403 forbidden, or 404 if the organization is
 * missing. The org row is fetched here so route handlers can rely on the
 * existence check having already happened.
 */
export function requirePlatformAdminOrOrgRole(
  minimumRole: RoleName,
  options: { paramName?: string } = {}
) {
  const paramName = options.paramName ?? "id";

  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Not authenticated",
      });
    }

    const params = request.params as Record<string, string | undefined>;
    const organizationId = params[paramName];
    if (!organizationId) {
      return reply.status(400).send({
        success: false,
        message: `Missing route parameter: ${paramName}`,
      });
    }

    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!orgRow[0]) {
      return reply.status(404).send({
        success: false,
        message: "Organization not found",
      });
    }

    if (request.user.isPlatformAdmin) return;

    const memberRow = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, request.user.id)
        )
      )
      .limit(1);

    const memberRole = memberRow[0]?.role;
    if (
      !memberRole ||
      !isValidRole(memberRole) ||
      !hasMinimumRole(memberRole, minimumRole)
    ) {
      return reply.status(403).send({
        success: false,
        message: `Platform admin or ${minimumRole} of this organization required`,
      });
    }
  };
}
