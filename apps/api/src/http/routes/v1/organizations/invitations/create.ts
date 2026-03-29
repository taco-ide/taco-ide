import { z } from "zod";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
} from "../../../_responses/types";
import { requireRole } from "../../../../middlewares/authorization";
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { isValidRole } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const OrgParamsSchema = z.object({
  id: z.string().uuid(),
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
      preHandler: [requireRole("coordinator")],
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

      if (organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Organization ID must match your active organization",
        });
      }

      if (!isValidRole(role)) {
        return reply.status(400).send({
          success: false as const,
          message: "Invalid role",
        });
      }

      const headers = getRequestHeaders(request);
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

      const data = result as { id?: string; email?: string; role?: string; status?: string; expiresAt?: Date };
      return reply.status(201).send({
        success: true as const,
        data: {
          id: data.id ?? "",
          email: data.email ?? email,
          role: data.role ?? role,
          status: data.status ?? "pending",
          expiresAt: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : "",
        },
      });
    }
  );
}
