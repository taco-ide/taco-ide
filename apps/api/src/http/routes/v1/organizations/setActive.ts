import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { invitation, organization, session } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

// Better Auth's organization plugin generates IDs with its own scheme
// (not strictly UUID). organization.id in the schema is `text(...)`, so we
// only require a non-empty string here.
const OrganizationParamsSchema = z.object({
  id: z.string().min(1),
});

const SetActiveBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const SetActiveResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    isActive: z.boolean(),
    clearedSessions: z.number(),
    canceledInvitations: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function setOrganizationActiveRoute(app: FastifyTypedInstance) {
  app.patch<{
    Params: z.infer<typeof OrganizationParamsSchema>;
    Body: z.infer<typeof SetActiveBodySchema>;
  }>(
    "/:id/active",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Toggle organization active flag (platform admin)",
        description:
          "Activates or deactivates an organization. When deactivating, also clears any session.activeOrganizationId pointing to this org (no FK enforces this) and cancels every pending invitation belonging to it (all within the same transaction).",
        params: OrganizationParamsSchema,
        body: SetActiveBodySchema,
        response: {
          200: SetActiveResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body;

      const existing = await db
        .select({ id: organization.id, isActive: organization.isActive })
        .from(organization)
        .where(eq(organization.id, id))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      // No-op when state is unchanged: skip the transaction and session
      // clearing entirely. Returns clearedSessions: 0 since nothing changed.
      if (existing[0].isActive === isActive) {
        return reply.status(200).send({
          success: true as const,
          data: {
            id: existing[0].id,
            isActive: existing[0].isActive,
            clearedSessions: 0,
            canceledInvitations: 0,
          },
        });
      }

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(organization)
          .set({ isActive, updatedAt: new Date() })
          .where(eq(organization.id, id))
          .returning({
            id: organization.id,
            isActive: organization.isActive,
          });

        let clearedSessions = 0;
        let canceledInvitations = 0;
        if (!isActive) {
          const cleared = await tx
            .update(session)
            .set({ activeOrganizationId: null, updatedAt: new Date() })
            .where(eq(session.activeOrganizationId, id))
            .returning({ id: session.id });
          clearedSessions = cleared.length;

          // Cancel every still-pending invitation belonging to this org so
          // they cannot be redeemed after a future reactivation (aligns with
          // soft-delete semantics for members).
          const canceled = await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(
                eq(invitation.organizationId, id),
                eq(invitation.status, "pending")
              )
            )
            .returning({ id: invitation.id });
          canceledInvitations = canceled.length;
        }

        return { updated, clearedSessions, canceledInvitations };
      });

      if (!result.updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update organization",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: result.updated.id,
          isActive: result.updated.isActive,
          clearedSessions: result.clearedSessions,
          canceledInvitations: result.canceledInvitations,
        },
      });
    }
  );
}
