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
  member,
} from "@repo/infra/db/schema";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const CreateEmailDomainParamsSchema = z.object({
  id: z.string().uuid(),
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
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id: organizationId } = request.params;
      const { domain, role } = request.body;

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

      if (!usr.isPlatformAdmin) {
        const memberRow = await db
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.organizationId, organizationId),
              eq(member.userId, usr.id)
            )
          )
          .limit(1);

        const memberRole = memberRow[0]?.role;
        if (
          !memberRole ||
          !isValidRole(memberRole) ||
          !hasMinimumRole(memberRole, "coordinator")
        ) {
          return reply.status(403).send({
            success: false as const,
            message:
              "Platform admin or coordinator of this organization required",
          });
        }
      }

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
