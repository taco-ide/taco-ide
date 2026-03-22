import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { requireRole } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const OrgParamsSchema = z.object({
  id: z.string().uuid(),
});

const MemberItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

const ListMembersResponseSchema = ResponseSchema200.extend({
  data: z.array(MemberItemSchema),
});

// ==================== ROUTE ====================

export async function listMembersRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof OrgParamsSchema>;
  }>(
    "/members",
    {
      preHandler: [requireRole("teacher")],
      schema: {
        tags: ["organizations"],
        summary: "List organization members",
        description:
          "List members of an organization. Requires teacher+ role. Organization ID must match active organization.",
        params: OrgParamsSchema,
        response: {
          200: ListMembersResponseSchema,
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

      if (organizationId !== usr.activeOrganizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Organization ID must match your active organization",
        });
      }

      const members = await db
        .select({
          id: member.id,
          userId: member.userId,
          name: user.name,
          email: user.email,
          role: member.role,
          createdAt: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, organizationId));

      return reply.status(200).send({
        success: true as const,
        data: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.name ?? "",
          email: m.email,
          role: m.role,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }
  );
}
