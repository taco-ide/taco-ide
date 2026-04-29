import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { organization } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const OrganizationParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateOrganizationBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    slug: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, {
        message: "Slug must be alphanumeric with optional hyphens",
      })
      .optional(),
    logo: z.string().url().nullable().optional(),
    metadata: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.slug !== undefined ||
      body.logo !== undefined ||
      body.metadata !== undefined,
    { message: "At least one field must be provided" }
  );

const UpdateOrganizationResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    metadata: z.string().nullable(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function updateOrganizationRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: z.infer<typeof OrganizationParamsSchema>;
    Body: z.infer<typeof UpdateOrganizationBodySchema>;
  }>(
    "/:id",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Update organization (platform admin)",
        description:
          "Updates name, slug, logo and/or metadata. Slug uniqueness is enforced.",
        params: OrganizationParamsSchema,
        body: UpdateOrganizationBodySchema,
        response: {
          200: UpdateOrganizationResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, slug, logo, metadata } = request.body;

      const existing = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, id))
        .limit(1);

      if (!existing[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      if (slug !== undefined) {
        const slugConflict = await db
          .select({ id: organization.id })
          .from(organization)
          .where(and(eq(organization.slug, slug), ne(organization.id, id)))
          .limit(1);

        if (slugConflict[0]) {
          return reply.status(409).send({
            success: false as const,
            message: "Organization slug already exists",
          });
        }
      }

      const updates: Partial<{
        name: string;
        slug: string;
        logo: string | null;
        metadata: string | null;
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      if (name !== undefined) updates.name = name;
      if (slug !== undefined) updates.slug = slug;
      if (logo !== undefined) updates.logo = logo;
      if (metadata !== undefined) updates.metadata = metadata;

      const [updated] = await db
        .update(organization)
        .set(updates)
        .where(eq(organization.id, id))
        .returning();

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update organization",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          logo: updated.logo ?? null,
          metadata: updated.metadata ?? null,
          isActive: updated.isActive,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    }
  );
}
