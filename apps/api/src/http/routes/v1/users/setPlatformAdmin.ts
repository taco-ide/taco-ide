import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { session, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const SetPlatformAdminParamsSchema = z.object({
  id: z.string().uuid(),
});

const SetPlatformAdminBodySchema = z.object({
  isPlatformAdmin: z.boolean(),
});

const SetPlatformAdminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isPlatformAdmin: z.boolean(),
  isActive: z.boolean(),
});

const SetPlatformAdminResponseSchema = ResponseSchema200.extend({
  data: SetPlatformAdminUserSchema,
});

// ==================== ROUTE ====================

export async function setPlatformAdminRoute(app: FastifyTypedInstance) {
  app.patch<{
    Params: z.infer<typeof SetPlatformAdminParamsSchema>;
    Body: z.infer<typeof SetPlatformAdminBodySchema>;
  }>(
    "/:id/platform-admin",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["users"],
        summary: "Toggle platform admin flag (admin)",
        description:
          "Sets `isPlatformAdmin` for a user. Blocks self-demotion when the caller is the only platform admin. On success, revokes all sessions of the target user so the 5-minute session cookie cache cannot keep stale claims.",
        params: SetPlatformAdminParamsSchema,
        body: SetPlatformAdminBodySchema,
        response: {
          200: SetPlatformAdminResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const caller = request.user;
      if (!caller) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id } = request.params;
      const { isPlatformAdmin } = request.body;

      const target = await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
          isActive: user.isActive,
        })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!target[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "User not found",
        });
      }

      // Block self-demotion if this is the only platform admin.
      if (
        !isPlatformAdmin &&
        target[0].isPlatformAdmin &&
        target[0].id === caller.id
      ) {
        const adminCountRow = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(user)
          .where(eq(user.isPlatformAdmin, true));
        const adminCount = Number(adminCountRow[0]?.count ?? 0);
        if (adminCount <= 1) {
          return reply.status(409).send({
            success: false as const,
            message: "Cannot demote the only Platform Admin",
          });
        }
      }

      const updated = await db
        .update(user)
        .set({ isPlatformAdmin, updatedAt: new Date() })
        .where(eq(user.id, id))
        .returning({
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
          isActive: user.isActive,
        });

      // Revoke all sessions of the target user so the cookie cache (5 min)
      // cannot carry the previous platform-admin value.
      await db.delete(session).where(eq(session.userId, id));

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated[0].id,
          email: updated[0].email,
          name: updated[0].name ?? "",
          isPlatformAdmin: updated[0].isPlatformAdmin,
          isActive: updated[0].isActive,
        },
      });
    }
  );
}
