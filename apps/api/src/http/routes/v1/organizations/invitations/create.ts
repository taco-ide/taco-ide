import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
} from "../../../_responses/types";
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { invitation } from "@repo/infra/db/schema";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// ==================== SCHEMAS ====================

const OrgParamsSchema = z.object({
  id: z.string().min(1),
});

const CreateInvitationBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["student", "teacher", "coordinator", "admin"]),
});

const InvitationResponseSchema = ResponseSchema201.extend({
  data: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
    status: z.string(),
    expiresAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function createInvitationRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof OrgParamsSchema>;
    Body: z.infer<typeof CreateInvitationBodySchema>;
  }>(
    "/invitations",
    {
      schema: {
        tags: ["organizations"],
        summary: "Create invitation",
        description:
          "Invite a user to the organization by email. Requires coordinator+ role.",
        params: OrgParamsSchema,
        body: CreateInvitationBodySchema,
        response: {
          201: InvitationResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
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

      const { id: organizationId } = request.params;
      const { email, role } = request.body;

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

      if (!isValidRole(role)) {
        return reply.status(400).send({
          success: false as const,
          message: "Invalid role",
        });
      }

      if (usr.isPlatformAdmin) {
        // Platform Admins may not be members of the target org, so the Better
        // Auth invitation handler (which requires an active membership) would
        // reject the call with a 500. Insert the invitation row directly,
        // matching the schema produced by the organization plugin.
        const normalizedEmail = email.toLowerCase();

        const existing = await db
          .select({ id: invitation.id })
          .from(invitation)
          .where(
            and(
              eq(invitation.email, normalizedEmail),
              eq(invitation.organizationId, organizationId),
              eq(invitation.status, "pending")
            )
          )
          .limit(1);

        if (existing[0]) {
          return reply.status(400).send({
            success: false as const,
            message: "A pending invitation already exists for this email",
          });
        }

        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
        const inserted = await db
          .insert(invitation)
          .values({
            id: randomUUID(),
            email: normalizedEmail,
            inviterId: usr.id,
            organizationId,
            role,
            status: "pending",
            expiresAt,
          })
          .returning({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          });

        const created = inserted[0];
        if (!created) {
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create invitation",
          });
        }

        return reply.status(201).send({
          success: true as const,
          data: {
            id: created.id,
            email: created.email,
            role: created.role,
            status: created.status,
            expiresAt: created.expiresAt.toISOString(),
          },
        });
      }

      const headers = getRequestHeaders(request);
      try {
        const result = await auth.api.createInvitation({
          body: {
            email,
            role,
            organizationId,
            resend: true,
          },
          headers,
        });

        if (!result) {
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create invitation",
          });
        }

        const data = result as {
          id?: string;
          email?: string;
          role?: string;
          status?: string;
          expiresAt?: Date;
        };
        return reply.status(201).send({
          success: true as const,
          data: {
            id: data.id ?? "",
            email: data.email ?? email,
            role: data.role ?? role,
            status: data.status ?? "pending",
            expiresAt:
              data.expiresAt instanceof Date ? data.expiresAt.toISOString() : "",
          },
        });
      } catch (err) {
        const error = err as {
          statusCode?: number;
          body?: { message?: string; code?: string };
          message?: string;
        };
        const message =
          error.body?.message ?? error.message ?? "Failed to create invitation";
        request.log.error({ err }, "createInvitation failed");
        return reply.status(400).send({
          success: false as const,
          message,
        });
      }
    }
  );
}
