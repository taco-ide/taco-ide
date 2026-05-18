import { z } from "zod";
import { ilike, or, sql, inArray, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member, organization, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const SearchUsersQuerySchema = z
  .object({
    q: z.string().trim().min(2),
    page: z.coerce.number().min(1).default(1),
    perPage: z.coerce.number().min(1).max(100).default(20),
  })
  .strict();

const SearchUsersMembershipSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  role: z.string(),
});

const SearchUsersItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isPlatformAdmin: z.boolean(),
  isActive: z.boolean(),
  memberships: z.array(SearchUsersMembershipSchema),
});

const SearchUsersResponseSchema = ResponseSchema200.extend({
  data: z.array(SearchUsersItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function searchUsersRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof SearchUsersQuerySchema>;
  }>(
    "/",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["users"],
        summary: "Search users (admin)",
        description:
          "Global, paginated user search by name or email (ilike). Each item includes the user's organization memberships. Platform admin only.",
        querystring: SearchUsersQuerySchema,
        response: {
          200: SearchUsersResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
        },
      },
    },
    async (request, reply) => {
      const { q, page, perPage } = request.query;
      const offset = (page - 1) * perPage;
      const pattern = `%${q}%`;

      const searchCondition = or(
        ilike(user.name, pattern),
        ilike(user.email, pattern)
      );

      const countRow = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(searchCondition);

      const total = Number(countRow[0]?.count ?? 0);

      const users = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          isPlatformAdmin: user.isPlatformAdmin,
          isActive: user.isActive,
        })
        .from(user)
        .where(searchCondition)
        .orderBy(user.name)
        .limit(perPage)
        .offset(offset);

      const userIds = users.map((u) => u.id);

      const memberships = userIds.length
        ? await db
            .select({
              userId: member.userId,
              organizationId: member.organizationId,
              organizationName: organization.name,
              role: member.role,
            })
            .from(member)
            .innerJoin(organization, eq(organization.id, member.organizationId))
            .where(inArray(member.userId, userIds))
        : [];

      const membershipsByUser = new Map<
        string,
        { organizationId: string; organizationName: string; role: string }[]
      >();
      for (const m of memberships) {
        const list = membershipsByUser.get(m.userId) ?? [];
        list.push({
          organizationId: m.organizationId,
          organizationName: m.organizationName,
          role: m.role,
        });
        membershipsByUser.set(m.userId, list);
      }

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: users.map((u) => ({
          id: u.id,
          name: u.name ?? "",
          email: u.email,
          isPlatformAdmin: u.isPlatformAdmin,
          isActive: u.isActive,
          memberships: membershipsByUser.get(u.id) ?? [],
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
