import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  classroom,
  member,
  organization,
  organizationEmailDomain,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

// Better Auth's organization plugin generates IDs with its own scheme
// (not strictly UUID). organization.id in the schema is `text(...)`, so we
// only require a non-empty string here.
const OrganizationParamsSchema = z.object({
  id: z.string().min(1),
});

const OrganizationDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  metadata: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  memberCount: z.number(),
  classroomCount: z.number(),
  domainCount: z.number(),
});

const GetOrganizationResponseSchema = ResponseSchema200.extend({
  data: OrganizationDetailSchema,
});

// ==================== AUTH ====================

async function platformAdminOrMember(
  request: FastifyRequest<{ Params: z.infer<typeof OrganizationParamsSchema> }>,
  reply: FastifyReply
) {
  const usr = request.user;
  if (!usr) {
    return reply.status(401).send({
      success: false as const,
      message: "Not authenticated",
    });
  }

  if (usr.isPlatformAdmin) {
    return;
  }

  const { id: organizationId } = request.params;
  const membership = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.userId, usr.id), eq(member.organizationId, organizationId))
    )
    .limit(1);

  if (!membership[0]) {
    return reply.status(403).send({
      success: false as const,
      message: "You must be a member of this organization",
    });
  }
}

// ==================== ROUTE ====================

export async function getOrganizationByIdRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof OrganizationParamsSchema>;
  }>(
    "/:id",
    {
      preHandler: [platformAdminOrMember],
      schema: {
        tags: ["organizations"],
        summary: "Get organization by ID",
        description:
          "Returns a single organization with member and domain counts. Platform admin can fetch any org; otherwise requires membership.",
        params: OrganizationParamsSchema,
        response: {
          200: GetOrganizationResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Single query: fetch the org row plus its three counts via correlated
      // subqueries. Reduces 4 roundtrips to 1.
      const orgRows = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          metadata: organization.metadata,
          isActive: organization.isActive,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
          memberCount: sql<number>`(
            SELECT count(*)::int FROM ${member}
            WHERE ${member.organizationId} = ${organization.id}
          )`,
          classroomCount: sql<number>`(
            SELECT count(*)::int FROM ${classroom}
            WHERE ${classroom.organizationId} = ${organization.id}
              AND ${classroom.deletedAt} IS NULL
          )`,
          domainCount: sql<number>`(
            SELECT count(*)::int FROM ${organizationEmailDomain}
            WHERE ${organizationEmailDomain.organizationId} = ${organization.id}
          )`,
        })
        .from(organization)
        .where(eq(organization.id, id))
        .limit(1);

      const org = orgRows[0];
      if (!org) {
        return reply.status(404).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo ?? null,
          metadata: org.metadata ?? null,
          isActive: org.isActive,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
          memberCount: Number(org.memberCount ?? 0),
          classroomCount: Number(org.classroomCount ?? 0),
          domainCount: Number(org.domainCount ?? 0),
        },
      });
    }
  );
}
