import { z } from "zod";
import { and, eq, ilike } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../../_responses/types";
import { requirePlatformAdmin } from "../../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member, organization, user } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const AddExistingMemberParamsSchema = z.object({
  id: z.string().min(1),
});

const AddExistingMemberBodySchema = z
  .object({
    email: z.string().email(),
    role: z.enum(["student", "teacher", "coordinator", "admin"]),
  })
  .strict();

const AddExistingMemberItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

const AddExistingMemberResponseSchema = ResponseSchema201.extend({
  data: AddExistingMemberItemSchema,
});

// ==================== ROUTE ====================

export async function addExistingMemberRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof AddExistingMemberParamsSchema>;
    Body: z.infer<typeof AddExistingMemberBodySchema>;
  }>(
    "/members",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Link existing user to organization (admin)",
        description:
          "Adds an existing user as a member of the target organization. Looks up the user by email and inserts a member row directly, bypassing Better Auth's membership limit. Returns 404 when the user does not exist and 409 when already a member.",
        params: AddExistingMemberParamsSchema,
        body: AddExistingMemberBodySchema,
        response: {
          201: AddExistingMemberResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const { id: organizationId } = request.params;
      const { email, role } = request.body;

      const orgRow = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!orgRow[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      const normalizedEmail = email.toLowerCase();
      const targetUser = await db
        .select({ id: user.id })
        .from(user)
        .where(ilike(user.email, normalizedEmail))
        .limit(1);

      if (!targetUser[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "User with this email does not exist",
        });
      }

      const existing = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, targetUser[0].id)
          )
        )
        .limit(1);

      if (existing[0]) {
        return reply.status(409).send({
          success: false as const,
          message: "User is already a member of this organization",
        });
      }

      const inserted = await db
        .insert(member)
        .values({
          id: randomUUID(),
          userId: targetUser[0].id,
          organizationId,
          role,
          createdAt: new Date(),
        })
        .returning({
          id: member.id,
          userId: member.userId,
          organizationId: member.organizationId,
          role: member.role,
          createdAt: member.createdAt,
        });

      const created = inserted[0];
      if (!created) {
        return reply.status(409).send({
          success: false as const,
          message: "Failed to insert member",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          userId: created.userId,
          organizationId: created.organizationId,
          role: created.role,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
