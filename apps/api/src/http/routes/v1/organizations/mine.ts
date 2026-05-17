import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { member, organization } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const MyOrgItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.string(),
});

const ListMineResponseSchema = ResponseSchema200.extend({
  data: z.array(MyOrgItemSchema),
});

// ==================== ROUTE ====================

/**
 * Lists the authenticated user's memberships restricted to ACTIVE
 * organizations. This is what the UI should call when picking a default org
 * after the session loses its activeOrganizationId — Better Auth's built-in
 * `organization.list()` doesn't expose our `is_active` flag, so it would
 * happily return deactivated orgs.
 *
 * Sorted by member.createdAt asc so the first item matches the deterministic
 * fallback used by the auth middleware (apps/api/src/http/middlewares/auth.ts).
 */
export async function listMyOrganizationsRoute(app: FastifyTypedInstance) {
  app.get(
    "/mine",
    {
      schema: {
        tags: ["organizations"],
        summary: "List organizations the current user belongs to (active only)",
        description:
          "Returns memberships restricted to active organizations, ordered by oldest membership first.",
        response: {
          200: ListMineResponseSchema,
          401: ResponseSchema401,
        },
      },
    },
    async (request, reply) => {
      const { user } = request;
      if (!user) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const rows = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(
          and(
            eq(member.userId, user.id),
            eq(organization.isActive, true)
          )
        )
        .orderBy(asc(member.createdAt));

      return reply.status(200).send({
        success: true as const,
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          role: r.role,
        })),
      });
    }
  );
}
