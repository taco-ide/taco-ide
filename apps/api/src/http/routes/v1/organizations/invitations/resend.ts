import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
  ResponseSchema500,
} from "../../../_responses/types";
import { sendInvitationEmail } from "@repo/infra/auth/invitation-email";
import { db } from "@repo/infra/db";
import { invitation, organization, user } from "@repo/infra/db/schema";
import { requirePlatformAdminOrOrgRole } from "../../../../middlewares/authorization";

// Same TTL used in invitations/create.ts. Kept in sync intentionally so a
// resend extends the lifetime by the standard window (7 days) instead of
// inventing a different policy.
const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// ==================== SCHEMAS ====================

const ResendInvitationParamsSchema = z.object({
  id: z.string().min(1),
  invitationId: z.string().min(1),
});

const ResendInvitationResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    status: z.string(),
    expiresAt: z.string().datetime(),
  }),
});

// ==================== ROUTE ====================

export async function resendInvitationRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ResendInvitationParamsSchema>;
  }>(
    "/invitations/:invitationId/resend",
    {
      // Coordinator+ matches the permission required to create/cancel
      // invitations in this module (see ./create.ts, ./delete.ts, ./list.ts).
      preHandler: requirePlatformAdminOrOrgRole("coordinator"),
      schema: {
        tags: ["organizations"],
        summary: "Resend invitation",
        description:
          "Resend a pending invitation email. Renews expiresAt to NOW() + 7 days and re-dispatches the email. Idempotent: re-calling on a pending invitation simply re-extends the TTL and re-sends the email. Non-pending invitations (accepted/canceled/expired/rejected) return 409.",
        params: ResendInvitationParamsSchema,
        response: {
          200: ResendInvitationResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
          500: ResponseSchema500,
        },
      },
    },
    async (request, reply) => {
      const { id: organizationId, invitationId } = request.params;

      // Fetch the invitation scoped to the org (defends against guessed IDs
      // belonging to a different org -> 404 instead of leaking existence).
      const existing = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          inviterId: invitation.inviterId,
        })
        .from(invitation)
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, organizationId)
          )
        )
        .limit(1);

      const inv = existing[0];
      if (!inv) {
        return reply.status(404).send({
          success: false as const,
          message: "Invitation not found",
        });
      }

      if (inv.status !== "pending") {
        return reply.status(409).send({
          success: false as const,
          message: `Cannot resend invitation in status ${inv.status}.`,
        });
      }

      const newExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);

      // Renew the TTL inside a short transaction so concurrent resends
      // collapse to a single committed state. We do not send the email
      // from within the TX to avoid holding the row lock across an
      // external HTTP call to the email provider.
      const updated = await db
        .update(invitation)
        .set({ expiresAt: newExpiresAt })
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, organizationId),
            eq(invitation.status, "pending")
          )
        )
        .returning({
          id: invitation.id,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        });

      const row = updated[0];
      if (!row) {
        // The invitation was concurrently transitioned out of "pending"
        // (accepted/canceled/expired/rejected) between our SELECT and
        // UPDATE. Surface as 409 so the UI refetches the list.
        return reply.status(409).send({
          success: false as const,
          message: "Cannot resend invitation: status changed concurrently.",
        });
      }

      // Re-dispatch the email outside the transaction. If this fails we
      // keep the DB update (TTL extended) and surface 500 so the operator
      // can retry. Logging includes the invitationId for traceability.
      try {
        const [orgRow] = await db
          .select({ name: organization.name })
          .from(organization)
          .where(eq(organization.id, organizationId))
          .limit(1);

        const [inviterRow] = inv.inviterId
          ? await db
              .select({ name: user.name })
              .from(user)
              .where(eq(user.id, inv.inviterId))
              .limit(1)
          : [undefined];

        await sendInvitationEmail({
          to: inv.email,
          organizationName: orgRow?.name ?? "your organization",
          invitationId: inv.id,
          inviterName: inviterRow?.name ?? undefined,
          expiresAt: row.expiresAt,
          role: inv.role,
        });
      } catch (err) {
        request.log.error(
          { err, invitationId: inv.id },
          "resendInvitation: sendInvitationEmail failed"
        );
        return reply.status(500).send({
          success: false as const,
          message: "Invitation TTL renewed but email delivery failed.",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: row.id,
          status: row.status,
          expiresAt: row.expiresAt.toISOString(),
        },
      });
    }
  );
}
