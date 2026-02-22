import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { user } from "@repo/infra/db/schema";
import { eq } from "drizzle-orm";

// ==================== SCHEMAS ====================

const UpdateUserBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  image: z.string().url().nullable().optional(),
});

const UserDataSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeOrganizationId: z.string().nullable(),
  role: z.string().nullable(),
});

const UpdateUserResponseSchema = ResponseSchema200.extend({
  data: UserDataSchema,
});

// ==================== ROUTE ====================

export async function updateUserRoute(app: FastifyTypedInstance) {
  app.put(
    "/me",
    {
      schema: {
        tags: ["users"],
        summary: "Update current user profile",
        description: "Updates the profile of the currently authenticated user",
        body: UpdateUserBodySchema,
        response: {
          200: UpdateUserResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
        },
      },
    },
    async (request, reply) => {
      const currentUser = request.user;

      if (!currentUser) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { name, image } = request.body;

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (image !== undefined) updateData.image = image;

      const updated = await db
        .update(user)
        .set(updateData)
        .where(eq(user.id, currentUser.id))
        .returning({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });

      if (!updated[0]) {
        return reply.status(400).send({
          success: false as const,
          message: "Failed to update user",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated[0].id,
          email: updated[0].email,
          name: updated[0].name,
          image: updated[0].image,
          emailVerified: updated[0].emailVerified,
          isActive: updated[0].isActive,
          createdAt: updated[0].createdAt.toISOString(),
          updatedAt: updated[0].updatedAt.toISOString(),
          activeOrganizationId: currentUser.activeOrganizationId,
          role: currentUser.role,
        },
      });
    }
  );
}
