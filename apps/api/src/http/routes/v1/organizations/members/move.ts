import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../../_responses/types";
import { requirePlatformAdmin } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member, organization } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const MoveMemberParamsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const MoveMemberBodySchema = z
  .object({
    toOrganizationId: z.string().min(1),
    newRole: z.enum(["student", "teacher", "coordinator", "admin"]),
  })
  .strict();

const MoveMemberItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

const MoveMemberResponseSchema = ResponseSchema200.extend({
  data: MoveMemberItemSchema,
});

// ==================== ROUTE ====================

export async function moveMemberRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof MoveMemberParamsSchema>;
    Body: z.infer<typeof MoveMemberBodySchema>;
  }>(
    "/members/:userId/move",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Move user between organizations (admin)",
        description:
          "Moves a user from the source organization to another active organization in a single transaction (delete + insert). Blocks the move when the user is the last admin of the source org.",
        params: MoveMemberParamsSchema,
        body: MoveMemberBodySchema,
        response: {
          200: MoveMemberResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const { id: fromOrganizationId, userId } = request.params;
      const { toOrganizationId, newRole } = request.body;

      if (fromOrganizationId === toOrganizationId) {
        return reply.status(400).send({
          success: false as const,
          message: "Source and target organizations must differ",
        });
      }

      const targetOrg = await db
        .select({ id: organization.id, isActive: organization.isActive })
        .from(organization)
        .where(eq(organization.id, toOrganizationId))
        .limit(1);

      if (!targetOrg[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Target organization not found",
        });
      }

      if (!targetOrg[0].isActive) {
        return reply.status(409).send({
          success: false as const,
          message: "Target organization is inactive",
        });
      }

      const newId = randomUUID();
      const now = new Date();

      // Run all guard checks + delete + insert inside a single transaction.
      // The last-admin lookup uses FOR UPDATE so concurrent moves/removals
      // cannot both pass the check and leave the source org without admins.
      const result = await db.transaction(async (tx) => {
        const sourceMember = await tx
          .select({ id: member.id, role: member.role })
          .from(member)
          .where(
            and(
              eq(member.organizationId, fromOrganizationId),
              eq(member.userId, userId)
            )
          )
          .limit(1);

        if (!sourceMember[0]) {
          return { kind: "not_found" as const };
        }

        if (sourceMember[0].role === "admin") {
          const adminRows = await tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.organizationId, fromOrganizationId),
                eq(member.role, "admin")
              )
            )
            .for("update");

          if (adminRows.length <= 1) {
            return { kind: "last_admin" as const };
          }
        }

        // Block if user is already a member of the target org (UNIQUE would
        // raise too, but we want a clear 409 instead of a 500).
        const alreadyMember = await tx
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, toOrganizationId),
              eq(member.userId, userId)
            )
          )
          .limit(1);

        if (alreadyMember[0]) {
          return { kind: "already_member" as const };
        }

        await tx.delete(member).where(eq(member.id, sourceMember[0].id));
        const insertedRows = await tx
          .insert(member)
          .values({
            id: newId,
            userId,
            organizationId: toOrganizationId,
            role: newRole,
            createdAt: now,
          })
          .returning({
            id: member.id,
            userId: member.userId,
            organizationId: member.organizationId,
            role: member.role,
            createdAt: member.createdAt,
          });
        return { kind: "ok" as const, inserted: insertedRows[0] };
      });

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false as const,
          message: "Member not found in source organization",
        });
      }

      if (result.kind === "last_admin") {
        return reply.status(409).send({
          success: false as const,
          message:
            "Cannot move the last admin of the source organization. Promote another member to admin first.",
        });
      }

      if (result.kind === "already_member") {
        return reply.status(409).send({
          success: false as const,
          message: "User is already a member of the target organization",
        });
      }

      const inserted = result.inserted;
      if (!inserted) {
        return reply.status(409).send({
          success: false as const,
          message: "Failed to insert member into target organization",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: inserted.id,
          userId: inserted.userId,
          organizationId: inserted.organizationId,
          role: inserted.role,
          createdAt: inserted.createdAt.toISOString(),
        },
      });
    }
  );
}
