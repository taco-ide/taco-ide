import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../../_responses/types";
import { requirePlatformAdmin } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const RemoveMemberParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

const RemoveMemberResponseSchema = ResponseSchema200.extend({
  data: z.object({
    message: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function removeMemberRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof RemoveMemberParamsSchema>;
  }>(
    "/members/:userId",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Remove member from organization (admin)",
        description:
          "Removes a user from an organization. Blocks removal of the last admin so the org never ends up unmanageable.",
        params: RemoveMemberParamsSchema,
        response: {
          200: RemoveMemberResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const { id: organizationId, userId } = request.params;

      const target = await db
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, userId)
          )
        )
        .limit(1);

      if (!target[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Member not found",
        });
      }

      // Block removal if this is the last admin of the org.
      if (target[0].role === "admin") {
        const adminCountRow = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(member)
          .where(
            and(
              eq(member.organizationId, organizationId),
              eq(member.role, "admin")
            )
          );

        const adminCount = Number(adminCountRow[0]?.count ?? 0);
        if (adminCount <= 1) {
          return reply.status(409).send({
            success: false as const,
            message:
              "Cannot remove the last admin of the organization. Promote another member to admin first.",
          });
        }
      }

      await db.delete(member).where(eq(member.id, target[0].id));

      return reply.status(200).send({
        success: true as const,
        data: {
          message: "Member removed successfully",
        },
      });
    }
  );
}
