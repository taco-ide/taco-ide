import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { member, organization } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const CreateOrganizationBodySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, {
      message: "Slug must be alphanumeric with optional hyphens",
    }),
  logo: z.string().url().optional(),
});

const OrganizationCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

const CreateOrganizationResponseSchema = ResponseSchema201.extend({
  data: OrganizationCreatedSchema,
});

// ==================== ROUTE ====================

export async function createOrganizationRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateOrganizationBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePlatformAdmin()],
      schema: {
        tags: ["organizations"],
        summary: "Create organization (platform admin)",
        description:
          "Creates a new organization via Better Auth. The platform admin who calls this endpoint becomes the org's first admin (creatorRole=admin).",
        body: CreateOrganizationBodySchema,
        response: {
          201: CreateOrganizationResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          409: ResponseSchema409,
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

      const { name, slug, logo } = request.body;

      // Reject duplicate slug up-front so we return a clean 409 instead of
      // relying on the unique-constraint error.
      const existing = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
        .limit(1);

      if (existing[0]) {
        return reply.status(409).send({
          success: false as const,
          message: "Organization slug already exists",
        });
      }

      try {
        const now = new Date();
        const orgId = randomUUID();

        const inserted = await db
          .insert(organization)
          .values({
            id: orgId,
            name,
            slug,
            logo: logo ?? null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
          .returning({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            isActive: organization.isActive,
            createdAt: organization.createdAt,
          });

        const org = inserted[0];
        if (!org) {
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create organization",
          });
        }

        // Make the calling Platform Admin the org's first admin to preserve
        // the previous Better Auth behavior (creatorRole=admin).
        await db.insert(member).values({
          id: randomUUID(),
          userId: usr.id,
          organizationId: org.id,
          role: "admin",
          createdAt: now,
        });

        return reply.status(201).send({
          success: true as const,
          data: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo ?? null,
            isActive: org.isActive,
            createdAt: org.createdAt.toISOString(),
          },
        });
      } catch (err) {
        const error = err as {
          code?: string;
          message?: string;
        };
        // Unique violation on slug (PostgreSQL 23505) as a defensive fallback.
        if (error.code === "23505") {
          return reply.status(409).send({
            success: false as const,
            message: "Organization slug already exists",
          });
        }

        request.log.error({ err }, "createOrganization failed");
        return reply.status(400).send({
          success: false as const,
          message: error.message ?? "Failed to create organization",
        });
      }
    }
  );
}
