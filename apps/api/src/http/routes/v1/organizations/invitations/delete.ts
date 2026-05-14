import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth, hasMinimumRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { invitation } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const OrgInvitationParamsSchema = z.object({
  id: z.string().min(1),
  invitationId: z.string(),
});

const DeleteInvitationResponseSchema = ResponseSchema200.extend({
  data: z.object({
    message: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function deleteInvitationRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof OrgInvitationParamsSchema>;
  }>(
    "/invitations/:invitationId",
    {
      schema: {
        tags: ["organizations"],
        summary: "Cancel invitation",
        description:
          "Cancel a pending invitation. Requires coordinator+ role.",
        params: OrgInvitationParamsSchema,
        response: {
          200: DeleteInvitationResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id: organizationId, invitationId } = request.params;

      // Platform admins bypass the active-organization + role check.
      if (!usr.isPlatformAdmin) {
        if (organizationId !== usr.activeOrganizationId) {
          return reply.status(403).send({
            success: false as const,
            message: "Organization ID must match your active organization",
          });
        }
        if (!usr.role || !hasMinimumRole(usr.role, "coordinator")) {
          return reply.status(403).send({
            success: false as const,
            message: "Insufficient role permissions",
          });
        }
      }

      const inv = await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!inv[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Invitation not found",
        });
      }

      if (usr.isPlatformAdmin) {
        // Platform Admin may not be a member of the org, so the Better Auth
        // cancelInvitation handler would reject. Mark the invitation as
        // canceled directly, matching the organization plugin schema.
        await db
          .update(invitation)
          .set({ status: "canceled" })
          .where(eq(invitation.id, invitationId));

        return reply.status(200).send({
          success: true as const,
          data: {
            message: "Invitation cancelled successfully",
          },
        });
      }

      const headers = getRequestHeaders(request);
      try {
        await auth.api.cancelInvitation({
          body: {
            invitationId,
          },
          headers,
        });

        return reply.status(200).send({
          success: true as const,
          data: {
            message: "Invitation cancelled successfully",
          },
        });
      } catch (err) {
        const error = err as {
          statusCode?: number;
          body?: { message?: string; code?: string };
          message?: string;
        };
        const message =
          error.body?.message ?? error.message ?? "Failed to cancel invitation";
        request.log.error({ err }, "cancelInvitation failed");
        return reply.status(403).send({
          success: false as const,
          message,
        });
      }
    }
  );
}
