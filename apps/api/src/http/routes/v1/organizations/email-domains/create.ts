import { z } from "zod";
import { eq, and } from "drizzle-orm";
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
import { db } from "@repo/infra/db";
import {
  organizationEmailDomain,
  organization,
} from "@repo/infra/db/schema";
import { requirePlatformAdminOrOrgRole } from "../../../../middlewares/authorization";

// PostgreSQL SQLSTATE for unique_violation. Used to distinguish a race on
// UNIQUE(domain, role) from any other DB error in the INSERT path.
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === PG_UNIQUE_VIOLATION;
}

// ==================== SCHEMAS ====================

const CreateEmailDomainParamsSchema = z.object({
  id: z.string().min(1),
});

const DomainSchema = z
  .string()
  .min(3)
  .max(253)
  .transform((s) => s.toLowerCase().trim().replace(/^@/, ""))
  .refine(
    (s) =>
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
        s
      ),
    { message: "Invalid domain format" }
  );

const CreateEmailDomainBodySchema = z.object({
  domain: DomainSchema,
  role: z.enum(["student", "teacher", "coordinator", "admin"]),
});

const CreateEmailDomainResponseSchema = ResponseSchema201.extend({
  data: z.object({
    id: z.string(),
    domain: z.string(),
    role: z.enum(["student", "teacher", "coordinator", "admin"]),
    createdAt: z.string().datetime(),
  }),
});

// ==================== ROUTE ====================

export async function createEmailDomainRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof CreateEmailDomainParamsSchema>;
    Body: z.infer<typeof CreateEmailDomainBodySchema>;
  }>(
    "/email-domains",
    {
      preHandler: requirePlatformAdminOrOrgRole("coordinator"),
      schema: {
        tags: ["organizations"],
        summary: "Create email domain rule",
        description:
          "Create an email domain auto-assignment rule for the organization. UNIQUE(domain, role) is global across all organizations. Allowed for platform admins or coordinators of the organization.",
        params: CreateEmailDomainParamsSchema,
        body: CreateEmailDomainBodySchema,
        response: {
          201: CreateEmailDomainResponseSchema,
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
      const { domain, role } = request.body;

      // Pre-check the (domain, role) UNIQUE constraint so we can return a
      // friendly 409 message including the conflicting organization name.
      const existing = await db
        .select({
          id: organizationEmailDomain.id,
          organizationId: organizationEmailDomain.organizationId,
          orgName: organization.name,
        })
        .from(organizationEmailDomain)
        .innerJoin(
          organization,
          eq(organization.id, organizationEmailDomain.organizationId)
        )
        .where(
          and(
            eq(organizationEmailDomain.domain, domain),
            eq(organizationEmailDomain.role, role)
          )
        )
        .limit(1);

      if (existing[0]) {
        const conflict = existing[0];
        const sameOrg = conflict.organizationId === organizationId;
        return reply.status(409).send({
          success: false as const,
          message: sameOrg
            ? `Domain "${domain}" with role "${role}" is already configured for this organization`
            : `Domain "${domain}" with role "${role}" is already in use by organization "${conflict.orgName}"`,
        });
      }

      const id = randomUUID();
      const createdAt = new Date();

      try {
        await db.insert(organizationEmailDomain).values({
          id,
          organizationId,
          domain,
          role,
          createdAt,
        });
      } catch (err) {
        // Only treat unique_violation (PG SQLSTATE 23505) as a race on the
        // (domain, role) UNIQUE constraint. Any other error must propagate
        // so it surfaces in logs and the caller gets a real 500 rather than
        // a misleading 409.
        if (!isUniqueViolation(err)) {
          throw err;
        }

        // Race condition: another writer inserted the same (domain, role)
        // between our SELECT and INSERT. Retry the lookup so we can return
        // the conflict message instead of a 500.
        const retry = await db
          .select({
            organizationId: organizationEmailDomain.organizationId,
            orgName: organization.name,
          })
          .from(organizationEmailDomain)
          .innerJoin(
            organization,
            eq(organization.id, organizationEmailDomain.organizationId)
          )
          .where(
            and(
              eq(organizationEmailDomain.domain, domain),
              eq(organizationEmailDomain.role, role)
            )
          )
          .limit(1);

        if (retry[0]) {
          const sameOrg = retry[0].organizationId === organizationId;
          return reply.status(409).send({
            success: false as const,
            message: sameOrg
              ? `Domain "${domain}" with role "${role}" is already configured for this organization`
              : `Domain "${domain}" with role "${role}" is already in use by organization "${retry[0].orgName}"`,
          });
        }

        throw err;
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id,
          domain,
          role,
          createdAt: createdAt.toISOString(),
        },
      });
    }
  );
}
