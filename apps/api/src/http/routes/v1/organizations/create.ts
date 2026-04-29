import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePlatformAdmin } from "../../../middlewares/authorization";
import { getRequestHeaders } from "../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { organization } from "@repo/infra/db/schema";

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
      const headers = getRequestHeaders(request);

      try {
        const result = await auth.api.createOrganization({
          body: {
            name,
            slug,
            ...(logo ? { logo } : {}),
            keepCurrentActiveOrganization: true,
          },
          headers,
        });

        if (!result?.id) {
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create organization",
          });
        }

        // Re-read to capture authoritative timestamps and isActive default.
        const persisted = await db
          .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            isActive: organization.isActive,
            createdAt: organization.createdAt,
          })
          .from(organization)
          .where(eq(organization.id, result.id))
          .limit(1);

        const org = persisted[0];
        if (!org) {
          return reply.status(400).send({
            success: false as const,
            message: "Organization was created but could not be loaded",
          });
        }

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
          status?: string | number;
          statusCode?: number;
          body?: { message?: string; code?: string };
          message?: string;
        };
        const status = error.statusCode ?? error.status;
        const code = error.body?.code ?? "";
        const message =
          error.body?.message ?? error.message ?? "Failed to create organization";

        if (
          status === 400 ||
          status === "BAD_REQUEST" ||
          code === "ORGANIZATION_ALREADY_EXISTS" ||
          /already exists|slug/i.test(message)
        ) {
          return reply.status(409).send({
            success: false as const,
            message: "Organization slug already exists",
          });
        }

        request.log.error({ err }, "createOrganization failed");
        return reply.status(400).send({
          success: false as const,
          message,
        });
      }
    }
  );
}
