import { FastifyReply, FastifyRequest } from "fastify";
import {
  hasMinimumRole,
  roleHasPermission,
} from "@repo/infra/auth";
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
