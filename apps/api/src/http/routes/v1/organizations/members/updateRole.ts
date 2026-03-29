import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requireRole } from "../../../../middlewares/authorization";
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { member } from "@repo/infra/db/schema";
import { isValidRole } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const OrgMembersParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

const UpdateRoleBodySchema = z.object({
  role: z.enum(["student", "teacher", "coordinator", "admin"]),
});

const UpdateRoleResponseSchema = ResponseSchema200.extend({
  data: z.object({
    message: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function updateMemberRoleRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof OrgMembersParamsSchema>;
    Body: z.infer<typeof UpdateRoleBodySchema>;
  }>(
    "/members/:userId",
    {
      preHandler: [requireRole("coordinator")],
      schema: {
        tags: ["organizations"],
        summary: "Update member role",
        description:
          "Update a member's role in the organization. Requires coordinator+ role.",
        params: OrgMembersParamsSchema,
        body: UpdateRoleBodySchema,
        response: {
          200: UpdateRoleResponseSchema,
          400: ResponseSchema400,
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

      const { id: organizationId, userId } = request.params;
      const { role } = request.body;

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

      const memberRow = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        )
        .limit(1);

      if (!memberRow[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Member not found",
        });
      }

      const headers = getRequestHeaders(request);
      await auth.api.updateMemberRole({
        body: {
          memberId: memberRow[0].id,
          role: [role],
          organizationId,
        },
        headers,
      });

      return reply.status(200).send({
        success: true as const,
        data: {
          message: "Member role updated successfully",
        },
      });
    }
  );
}
