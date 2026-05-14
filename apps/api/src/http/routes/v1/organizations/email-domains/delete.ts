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
import { organizationEmailDomain } from "@repo/infra/db/schema";
import { requirePlatformAdminOrOrgRole } from "../../../../middlewares/authorization";

// ==================== SCHEMAS ====================

const DeleteEmailDomainParamsSchema = z.object({
  id: z.string().min(1),
  domainId: z.string(),
});

// ==================== ROUTE ====================

export async function deleteEmailDomainRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteEmailDomainParamsSchema>;
  }>(
    "/email-domains/:domainId",
    {
      preHandler: requirePlatformAdminOrOrgRole("coordinator"),
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
      const { id: organizationId, domainId } = request.params;

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
