import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import { invitation, user } from "@repo/infra/db/schema";
import { requirePlatformAdminOrOrgRole } from "../../../../middlewares/authorization";

// ==================== SCHEMAS ====================

const ListInvitationsParamsSchema = z.object({
  id: z.string().min(1),
});

const ListInvitationsQuerySchema = z
  .object({
    // "pending" (default) lists only invitations awaiting acceptance. "all"
    // also includes accepted, rejected, canceled and expired rows for
    // auditing in the admin UI.
    status: z.enum(["pending", "all"]).optional().default("pending"),
  })
  .strict();

const InvitationItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  inviterId: z.string().nullable(),
  inviterName: z.string().nullable(),
  inviterEmail: z.string().nullable(),
});

const ListInvitationsResponseSchema = ResponseSchema200.extend({
  data: z.array(InvitationItemSchema),
});

// ==================== ROUTE ====================

export async function listInvitationsRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ListInvitationsParamsSchema>;
    Querystring: z.infer<typeof ListInvitationsQuerySchema>;
  }>(
    "/invitations",
    {
      // Coordinator+ matches the permission required to create/cancel
      // invitations in this module (see ./create.ts and ./delete.ts).
      preHandler: requirePlatformAdminOrOrgRole("coordinator"),
      schema: {
        tags: ["organizations"],
        summary: "List invitations",
        description:
          "List invitations for an organization. Defaults to pending only. Allowed for platform admins or coordinators+ of the organization.",
        params: ListInvitationsParamsSchema,
        querystring: ListInvitationsQuerySchema,
        response: {
          200: ListInvitationsResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const { id: organizationId } = request.params;
      const { status } = request.query;

      const conditions = [eq(invitation.organizationId, organizationId)];
      if (status === "pending") {
        conditions.push(eq(invitation.status, "pending"));
      }

      const rows = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          inviterId: invitation.inviterId,
          inviterName: user.name,
          inviterEmail: user.email,
        })
        .from(invitation)
        .leftJoin(user, eq(invitation.inviterId, user.id))
        .where(and(...conditions))
        .orderBy(desc(invitation.createdAt));

      return reply.status(200).send({
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          expiresAt: row.expiresAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
          inviterId: row.inviterId ?? null,
          inviterName: row.inviterName ?? null,
          inviterEmail: row.inviterEmail ?? null,
        })),
      });
    }
  );
}
