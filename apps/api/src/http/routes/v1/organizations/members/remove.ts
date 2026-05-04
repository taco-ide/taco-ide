import { z } from "zod";
import { and, eq } from "drizzle-orm";
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

      // Run guard + delete inside a transaction. Locking the admin rows with
      // FOR UPDATE serializes concurrent removals so two requests cannot both
      // pass the last-admin check and leave the org without administrators.
      const result = await db.transaction(async (tx) => {
        const target = await tx
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
          return { kind: "not_found" as const };
        }

        if (target[0].role === "admin") {
          const adminRows = await tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.organizationId, organizationId),
                eq(member.role, "admin")
              )
            )
            .for("update");

          if (adminRows.length <= 1) {
            return { kind: "last_admin" as const };
          }
        }

        await tx.delete(member).where(eq(member.id, target[0].id));
        return { kind: "ok" as const };
      });

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false as const,
          message: "Member not found",
        });
      }

      if (result.kind === "last_admin") {
        return reply.status(409).send({
          success: false as const,
          message:
            "Cannot remove the last admin of the organization. Promote another member to admin first.",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          message: "Member removed successfully",
        },
      });
    }
  );
}
