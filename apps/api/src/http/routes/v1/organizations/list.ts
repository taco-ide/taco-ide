import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { classroom, member, organization } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListOrganizationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  includeInactive: z.coerce.boolean().default(false),
});

const OrganizationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  memberCount: z.number(),
  classroomCount: z.number(),
});

const ListOrganizationsResponseSchema = ResponseSchema200.extend({
  data: z.array(OrganizationListItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listOrganizationsRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof ListOrganizationsQuerySchema>;
  }>(
    "/",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "List organizations (platform admin)",
        description:
          "Paginated list of organizations with member counts. Requires platform admin. Inactive orgs hidden by default.",
        querystring: ListOrganizationsQuerySchema,
        response: {
          200: ListOrganizationsResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
        },
      },
    },
    async (request, reply) => {
      const { page, perPage, q, includeInactive } = request.query;
      const offset = (page - 1) * perPage;

      const conditions = [];
      if (!includeInactive) {
        conditions.push(eq(organization.isActive, true));
      }
      if (q) {
        const term = `%${q}%`;
        const search = or(
          ilike(organization.name, term),
          ilike(organization.slug, term)
        );
        if (search) {
          conditions.push(search);
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(organization)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      // Use a correlated subquery for classroomCount so it does not
      // multiply against the LEFT JOIN to member (Cartesian product).
      const classroomCountSql = sql<number>`(
        SELECT count(*)::int FROM ${classroom}
        WHERE ${classroom.organizationId} = ${organization.id}
          AND ${classroom.deletedAt} IS NULL
      )`;

      const rows = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          isActive: organization.isActive,
          createdAt: organization.createdAt,
          memberCount: sql<number>`count(${member.id})::int`,
          classroomCount: classroomCountSql,
        })
        .from(organization)
        .leftJoin(member, eq(member.organizationId, organization.id))
        .where(whereClause)
        .groupBy(organization.id)
        .orderBy(desc(organization.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.max(1, Math.ceil(total / perPage));

      return reply.status(200).send({
        success: true as const,
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          logo: r.logo ?? null,
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString(),
          memberCount: Number(r.memberCount ?? 0),
          classroomCount: Number(r.classroomCount ?? 0),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
