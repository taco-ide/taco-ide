import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { db } from "@repo/infra/db";
import { organizationEmailDomain } from "@repo/infra/db/schema";
import { requirePlatformAdminOrOrgRole } from "../../../../middlewares/authorization";

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
      preHandler: requirePlatformAdminOrOrgRole("coordinator"),
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
      const { id: organizationId } = request.params;

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
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      }));

      return reply.status(200).send({
        success: true as const,
        data,
      });
    }
  );
}
