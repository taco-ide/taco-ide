import { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { hasMinimumRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { organization } from "@repo/infra/db/schema";
import type { RoleName } from "@repo/infra/auth";
import { getMembershipRole } from "../services/work-session-access";

// Staff authorization is evaluated against the caller's role in the
// organization that owns the target (the `:id` organization here, or the
// resource's organization inside the resource-access services). The session's
// active organization (`request.user.role`) is a UI preference and must never
// gate access to another organization's resources (#118).

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
 * Middleware factory for routes scoped to an organization in the URL params
 * (e.g. `/v1/organizations/:id/...`). Authorizes the request when the user is:
 *   - authenticated, AND
 *   - either a platform admin, or a current member of that organization
 *     (which must have `isActive` set) with at least `minimumRole` in it.
 *
 * The caller's active organization is irrelevant. Better Auth `owner` counts
 * as `admin`; inactive organizations and users never pass the role check.
 *
 * Returns 401 unauthenticated, 403 forbidden, or 404 if the organization is
 * missing. The org row is fetched here so route handlers can rely on the
 * existence check having already happened.
 */
export function requirePlatformAdminOrOrgRole(
  minimumRole: RoleName,
  options: { paramName?: string } = {},
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

    const memberRole = await getMembershipRole(request.user.id, organizationId);
    if (!memberRole || !hasMinimumRole(memberRole, minimumRole)) {
      return reply.status(403).send({
        success: false,
        message: `Platform admin or ${minimumRole} of this organization required`,
      });
    }
  };
}
