import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
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

const ListEmailDomainsParamsSchema = z.object({
  id: z.string().uuid(),
});

const EmailDomainItemSchema = z.object({
  id: z.string(),
  domain: z.string(),
  role: z.enum(["student", "teacher", "coordinator", "admin"]),
  createdAt: z.string().datetime(),
});

const ListEmailDomainsResponseSchema = ResponseSchema200.extend({
  data: z.array(EmailDomainItemSchema),
});

// ==================== ROUTE ====================

export async function listEmailDomainsRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ListEmailDomainsParamsSchema>;
  }>(
    "/email-domains",
    {
      schema: {
        tags: ["organizations"],
        summary: "List email domain rules",
        description:
          "List the email domain auto-assignment rules for the organization. Allowed for platform admins or coordinators of the organization.",
        params: ListEmailDomainsParamsSchema,
        response: {
          200: ListEmailDomainsResponseSchema,
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

      const { id: organizationId } = request.params;

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

        const role = memberRow[0]?.role;
        if (
          !role ||
          !isValidRole(role) ||
          !hasMinimumRole(role, "coordinator")
        ) {
          return reply.status(403).send({
            success: false as const,
            message:
              "Platform admin or coordinator of this organization required",
          });
        }
      }

      const rows = await db
        .select({
          id: organizationEmailDomain.id,
          domain: organizationEmailDomain.domain,
          role: organizationEmailDomain.role,
          createdAt: organizationEmailDomain.createdAt,
        })
        .from(organizationEmailDomain)
        .where(eq(organizationEmailDomain.organizationId, organizationId))
        .orderBy(asc(organizationEmailDomain.createdAt));

      const data = rows.map((row) => ({
        id: row.id,
        domain: row.domain,
        role: row.role as "student" | "teacher" | "coordinator" | "admin",
        createdAt: row.createdAt.toISOString(),
      }));

      return reply.status(200).send({
        success: true as const,
        data,
      });
    }
  );
}
