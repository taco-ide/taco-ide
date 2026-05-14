import { z } from "zod";
import { eq } from "drizzle-orm";
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
  id: z.string().min(1),
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
          "Sets `isPlatformAdmin` for a user. Blocks any demotion that would leave the platform without a Platform Admin (the guard runs inside a transaction with FOR UPDATE row locks to be safe under concurrency). On success, revokes all sessions of the target user so the 5-minute session cookie cache cannot keep stale claims.",
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
      if (!request.user) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id } = request.params;
      const { isPlatformAdmin } = request.body;

      // Run target lookup, last-platform-admin guard, update and session
      // revocation inside a single transaction. The platform-admin lookup
      // uses FOR UPDATE so concurrent demotions cannot both pass the check
      // and leave the platform without administrators.
      const result = await db.transaction(async (tx) => {
        const target = await tx
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
          return { kind: "not_found" as const };
        }

        if (
          !isPlatformAdmin &&
          target[0].isPlatformAdmin
        ) {
          const adminRows = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.isPlatformAdmin, true))
            .for("update");

          if (adminRows.length <= 1) {
            return { kind: "last_admin" as const };
          }
        }

        const updatedRows = await tx
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

        const updatedUser = updatedRows[0];
        if (!updatedUser) {
          return { kind: "not_found" as const };
        }

        // Revoke all sessions of the target user so the cookie cache (5 min)
        // cannot carry the previous platform-admin value.
        await tx.delete(session).where(eq(session.userId, id));

        return { kind: "ok" as const, updatedUser };
      });

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false as const,
          message: "User not found",
        });
      }

      if (result.kind === "last_admin") {
        return reply.status(409).send({
          success: false as const,
          message: "Cannot demote the only Platform Admin",
        });
      }

      const updatedUser = result.updatedUser;

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name ?? "",
          isPlatformAdmin: updatedUser.isPlatformAdmin,
          isActive: updatedUser.isActive,
        },
      });
    }
  );
}
