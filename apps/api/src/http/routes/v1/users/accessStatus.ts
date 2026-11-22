import { z } from "zod";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema401 } from "../../_responses/types";
import { db } from "@repo/infra/db";
import { invitation, member, organization, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const PendingInvitationSchema = z.object({
  id: z.string(),
  organizationName: z.string(),
  role: z.string(),
  inviterName: z.string().nullable(),
  expiresAt: z.string().datetime(),
});

const AccessStatusResponseSchema = ResponseSchema200.extend({
  data: z.object({
    hasActiveMembership: z.boolean(),
    hasInactiveOrganizationMembership: z.boolean(),
    pendingInvitations: z.array(PendingInvitationSchema),
  }),
});

// ==================== ROUTE ====================

/**
 * First-access helper for users that the auth middleware could not resolve
 * to an active organization. Tells the UI whether the user still belongs to
 * a deactivated organization (vs. never having been added) and lists the
 * pending invitations addressed to their email, so the "no organization"
 * screen can point them at /auth/accept-invitation.
 *
 * Invitation ids are bearer links, so they are only listed for verified
 * email addresses.
 */
export async function accessStatusRoute(app: FastifyTypedInstance) {
  app.get(
    "/me/access-status",
    {
      schema: {
        tags: ["users"],
        summary: "Get the current user's organization access status",
        description:
          "Returns whether the current user has active or deactivated organization memberships and lists pending, unexpired invitations to active organizations addressed to their verified email.",
        response: {
          200: AccessStatusResponseSchema,
          401: ResponseSchema401,
        },
      },
    },
    async (request, reply) => {
      const { user: currentUser } = request;
      if (!currentUser) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const memberships = await db
        .select({ isActive: organization.isActive })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(eq(member.userId, currentUser.id));

      const pending = currentUser.emailVerified
        ? await db
            .select({
              id: invitation.id,
              organizationName: organization.name,
              role: invitation.role,
              inviterName: user.name,
              expiresAt: invitation.expiresAt,
            })
            .from(invitation)
            .innerJoin(
              organization,
              eq(organization.id, invitation.organizationId)
            )
            .leftJoin(user, eq(user.id, invitation.inviterId))
            .where(
              and(
                sql`lower(${invitation.email}) = ${currentUser.email.toLowerCase()}`,
                eq(invitation.status, "pending"),
                gt(invitation.expiresAt, new Date()),
                eq(organization.isActive, true)
              )
            )
            .orderBy(asc(invitation.createdAt))
        : [];

      return reply.status(200).send({
        success: true as const,
        data: {
          hasActiveMembership: memberships.some((m) => m.isActive),
          hasInactiveOrganizationMembership: memberships.some(
            (m) => !m.isActive
          ),
          pendingInvitations: pending.map((row) => ({
            id: row.id,
            organizationName: row.organizationName,
            role: row.role,
            inviterName: row.inviterName ?? null,
            expiresAt: row.expiresAt.toISOString(),
          })),
        },
      });
    }
  );
}
