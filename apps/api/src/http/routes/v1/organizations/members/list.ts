import { z } from "zod";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema200,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../../_responses/types";
import { hasMinimumRole } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import {
  invitation,
  member,
  organizationEmailDomain,
  user,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListMembersParamsSchema = z.object({
  id: z.string().min(1),
});

const ListMembersQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    role: z.enum(["student", "teacher", "coordinator", "admin"]).optional(),
  })
  .strict();

const MemberItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
  joinedVia: z.enum(["domain", "manual", "invitation"]),
});

const ListMembersResponseSchema = ResponseSchema200.extend({
  data: z.array(MemberItemSchema),
});

// ==================== ROUTE ====================

export async function listMembersRoute(app: FastifyTypedInstance) {
  app.get<{
    Params: z.infer<typeof ListMembersParamsSchema>;
    Querystring: z.infer<typeof ListMembersQuerySchema>;
  }>(
    "/members",
    {
      schema: {
        tags: ["organizations"],
        summary: "List organization members",
        description:
          "List members of an organization. Platform admins can list members of any organization; otherwise the caller must be a teacher+ in the org and the id must match the active organization.",
        params: ListMembersParamsSchema,
        querystring: ListMembersQuerySchema,
        response: {
          200: ListMembersResponseSchema,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
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
      const { q, role: roleFilter } = request.query;

      // Platform admins bypass the active-organization + role check.
      if (!usr.isPlatformAdmin) {
        if (organizationId !== usr.activeOrganizationId) {
          return reply.status(403).send({
            success: false as const,
            message: "Organization ID must match your active organization",
          });
        }
        if (!usr.role || !hasMinimumRole(usr.role, "teacher")) {
          return reply.status(403).send({
            success: false as const,
            message: "Insufficient role permissions",
          });
        }
      }

      const conditions = [eq(member.organizationId, organizationId)];

      if (q) {
        const pattern = `%${q}%`;
        const search = or(ilike(user.name, pattern), ilike(user.email, pattern));
        if (search) {
          conditions.push(search);
        }
      }

      if (roleFilter) {
        conditions.push(eq(member.role, roleFilter));
      }

      const members = await db
        .select({
          id: member.id,
          userId: member.userId,
          name: user.name,
          email: user.email,
          role: member.role,
          createdAt: member.createdAt,
          lastActiveAt: member.lastActiveAt,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(...conditions));

      // Resolve joinedVia per member without N+1 queries.
      const emails = members.map((m) => m.email);
      const domains = Array.from(
        new Set(
          emails
            .map((e) => e.split("@")[1]?.toLowerCase())
            .filter((d): d is string => Boolean(d))
        )
      );

      const domainRules =
        domains.length > 0
          ? await db
              .select({
                domain: organizationEmailDomain.domain,
                role: organizationEmailDomain.role,
              })
              .from(organizationEmailDomain)
              .where(
                and(
                  eq(organizationEmailDomain.organizationId, organizationId),
                  inArray(organizationEmailDomain.domain, domains)
                )
              )
          : [];

      const domainRoleByDomain = new Map<string, Set<string>>();
      for (const rule of domainRules) {
        const set = domainRoleByDomain.get(rule.domain) ?? new Set<string>();
        set.add(rule.role);
        domainRoleByDomain.set(rule.domain, set);
      }

      const invitedEmails =
        emails.length > 0
          ? await db
              .select({ email: invitation.email })
              .from(invitation)
              .where(
                and(
                  eq(invitation.organizationId, organizationId),
                  inArray(invitation.email, emails)
                )
              )
          : [];

      const invitedSet = new Set(invitedEmails.map((i) => i.email.toLowerCase()));

      function deriveJoinedVia(
        email: string,
        memberRole: string
      ): "domain" | "manual" | "invitation" {
        const domain = email.split("@")[1]?.toLowerCase();
        if (domain) {
          const roles = domainRoleByDomain.get(domain);
          if (roles && roles.has(memberRole)) {
            return "domain";
          }
        }
        if (invitedSet.has(email.toLowerCase())) {
          return "invitation";
        }
        return "manual";
      }

      return reply.status(200).send({
        success: true as const,
        data: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.name ?? "",
          email: m.email,
          role: m.role,
          createdAt: m.createdAt.toISOString(),
          lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
          joinedVia: deriveJoinedVia(m.email, m.role),
        })),
      });
    }
  );
}
