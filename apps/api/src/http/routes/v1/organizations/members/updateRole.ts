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
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { member } from "@repo/infra/db/schema";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const OrgMembersParamsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const UpdateRoleBodySchema = z
  .object({
    role: z.enum(["student", "teacher", "coordinator", "admin"]),
  })
  .strict();

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

      if (usr.isPlatformAdmin) {
        await db
          .update(member)
          .set({ role })
          .where(eq(member.id, memberRow[0].id));
      } else {
        const headers = getRequestHeaders(request);
        try {
          await auth.api.updateMemberRole({
            body: {
              memberId: memberRow[0].id,
              role: [role],
              organizationId,
            },
            headers,
          });
        } catch (err) {
          const error = err as {
            statusCode?: number;
            status?: number;
            body?: { message?: string; code?: string };
            message?: string;
          };
          const statusCode =
            typeof error.statusCode === "number" && error.statusCode >= 400
              ? error.statusCode
              : typeof error.status === "number" && error.status >= 400
                ? error.status
                : 400;
          const message =
            error.body?.message ?? error.message ?? "Failed to update member role";
          request.log.error({ err }, "updateMemberRole failed");
          return reply.status(statusCode).send({
            success: false as const,
            message,
          });
        }
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          message: "Member role updated successfully",
        },
      });
    }
  );
}
