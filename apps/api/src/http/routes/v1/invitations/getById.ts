import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema404 } from "../../_responses/types";
import { db } from "@repo/infra/db";
import { invitation, organization, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const InvitationParamsSchema = z.object({
  id: z.string().min(1).max(255),
});

export const INVITATION_PREVIEW_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "expired",
] as const;

// A pending invitation carries what the accept page needs before sign-in.
// Once it is no longer pending, only the status and organization remain, so
// an old link stops exposing the invited email and the inviter.
const PendingInvitationPreviewSchema = z.object({
  id: z.string(),
  status: z.literal("pending"),
  organizationName: z.string(),
  email: z.string(),
  role: z.string(),
  expiresAt: z.string().datetime(),
  inviterName: z.string().nullable(),
});

const ClosedInvitationPreviewSchema = z.object({
  id: z.string(),
  status: z.enum(["accepted", "rejected", "canceled", "expired"]),
  organizationName: z.string(),
});

const InvitationPreviewSchema = z.discriminatedUnion("status", [
  PendingInvitationPreviewSchema,
  ClosedInvitationPreviewSchema,
]);

const InvitationPreviewResponseSchema = ResponseSchema200.extend({
  data: InvitationPreviewSchema,
});

type PreviewStatus = (typeof INVITATION_PREVIEW_STATUSES)[number];

function resolveStatus(row: {
  status: string;
  expiresAt: Date;
  organizationIsActive: boolean;
}): PreviewStatus {
  if (row.status === "accepted" || row.status === "rejected") return row.status;
  // Deactivating an organization cancels its pending invitations; treat any
  // leftover pending row of an inactive org the same way.
  if (row.status === "canceled" || !row.organizationIsActive) return "canceled";
  if (row.status !== "pending") return "canceled";
  return row.expiresAt.getTime() < Date.now() ? "expired" : "pending";
}

// ==================== ROUTE ====================

/**
 * Public, read-only preview of an invitation for the accept page
 * (`/auth/accept-invitation?id=...`).
 *
 * Better Auth's own `organization.getInvitation` needs a session, returns
 * the same error for expired / canceled / accepted invitations, and fails
 * when the inviter is not a member (platform admins create invitations for
 * organizations they don't belong to). The page needs to explain each case
 * and prefill the invited email on sign-up before the visitor has an
 * account, so it reads this endpoint instead.
 *
 * The invitation id is an unguessable bearer value delivered by email; this
 * route only exposes what the email itself already contains, and only while
 * the invitation is pending. Accepting and
 * declining still go through Better Auth, which checks the session email.
 */
export async function getInvitationPreviewRoute(app: FastifyTypedInstance) {
  app.get<{ Params: z.infer<typeof InvitationParamsSchema> }>(
    "/:id",
    {
      schema: {
        tags: ["invitations"],
        summary: "Get invitation preview",
        description:
          "Public. For a pending invitation, returns the organization, role, invited email, inviter and expiry so the accept page can render it before sign-in. Once the invitation is no longer pending, returns only its status and organization name.",
        params: InvitationParamsSchema,
        response: {
          200: InvitationPreviewResponseSchema,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const [row] = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          organizationName: organization.name,
          organizationIsActive: organization.isActive,
          inviterName: user.name,
        })
        .from(invitation)
        .innerJoin(organization, eq(organization.id, invitation.organizationId))
        .leftJoin(user, eq(user.id, invitation.inviterId))
        .where(eq(invitation.id, request.params.id))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          success: false as const,
          message: "Invitation not found",
        });
      }

      const status = resolveStatus(row);
      if (status !== "pending") {
        return reply.status(200).send({
          success: true as const,
          data: { id: row.id, status, organizationName: row.organizationName },
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: row.id,
          status,
          organizationName: row.organizationName,
          email: row.email,
          role: row.role,
          expiresAt: row.expiresAt.toISOString(),
          inviterName: row.inviterName ?? null,
        },
      });
    }
  );
}
