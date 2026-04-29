import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import {
  organizationEmailDomain,
  organization,
  member,
} from "@repo/infra/db/schema";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const DeleteEmailDomainParamsSchema = z.object({
  id: z.string().uuid(),
  domainId: z.string(),
});

// ==================== ROUTE ====================

export async function deleteEmailDomainRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteEmailDomainParamsSchema>;
  }>(
    "/email-domains/:domainId",
    {
      schema: {
        tags: ["organizations"],
        summary: "Delete email domain rule",
        description:
          "Hard delete an email domain auto-assignment rule. Existing members are not affected. Allowed for platform admins or coordinators of the organization.",
        params: DeleteEmailDomainParamsSchema,
        response: {
          204: ResponseSchema204,
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

      const { id: organizationId, domainId } = request.params;

      const orgRow = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!orgRow[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      if (!usr.isPlatformAdmin) {
        const memberRow = await db
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.organizationId, organizationId),
              eq(member.userId, usr.id)
            )
          )
          .limit(1);

        const memberRole = memberRow[0]?.role;
        if (
          !memberRole ||
          !isValidRole(memberRole) ||
          !hasMinimumRole(memberRole, "coordinator")
        ) {
          return reply.status(403).send({
            success: false as const,
            message:
              "Platform admin or coordinator of this organization required",
          });
        }
      }

      const existing = await db
        .select({ id: organizationEmailDomain.id })
        .from(organizationEmailDomain)
        .where(
          and(
            eq(organizationEmailDomain.id, domainId),
            eq(organizationEmailDomain.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Email domain rule not found",
        });
      }

      await db
        .delete(organizationEmailDomain)
        .where(eq(organizationEmailDomain.id, domainId));

      return reply.status(204).send();
    }
  );
}
