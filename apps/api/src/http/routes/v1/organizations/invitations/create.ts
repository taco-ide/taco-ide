import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema409,
} from "../../../_responses/types";
import { getRequestHeaders } from "../../../../lib/requestHeaders";
import { auth } from "@repo/infra/auth";
import { hasMinimumRole, isValidRole } from "@repo/infra/auth";
import { sendInvitationEmail } from "@repo/infra/auth/invitation-email";
import { db } from "@repo/infra/db";
import { invitation, organization, user } from "@repo/infra/db/schema";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// ==================== SCHEMAS ====================

const OrgParamsSchema = z.object({
  id: z.string().min(1),
});

const CreateInvitationBodySchema = z
  .object({
    email: z.string().email(),
    role: z.enum(["student", "teacher", "coordinator", "admin"]),
  })
  .strict();

const InvitationResponseSchema = ResponseSchema201.extend({
  data: z.object({
    id: z.string(),
    email: z.string(),
    role: z.string(),
    status: z.string(),
    expiresAt: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function createInvitationRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof OrgParamsSchema>;
    Body: z.infer<typeof CreateInvitationBodySchema>;
  }>(
    "/invitations",
    {
      schema: {
        tags: ["organizations"],
        summary: "Create invitation",
        description:
          "Invite a user to the organization by email. Requires coordinator+ role.",
        params: OrgParamsSchema,
        body: CreateInvitationBodySchema,
        response: {
          201: InvitationResponseSchema,
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

      const { id: organizationId } = request.params;
      const { email, role } = request.body;

      // Platform admins bypass the active-organization + role check.
      if (!usr.isPlatformAdmin) {
        if (organizationId !== usr.activeOrganizationId) {
          return reply.status(403).send({
            success: false as const,
            message: "Organization ID must match your active organization",
          });
        }
        if (!usr.role || !hasMinimumRole(usr.role, "coordinator")) {
          return reply.status(403).send({
            success: false as const,
            message: "Insufficient role permissions",
          });
        }
      }

      if (!isValidRole(role)) {
        return reply.status(400).send({
          success: false as const,
          message: "Invalid role",
        });
      }

      if (usr.isPlatformAdmin) {
        // Platform Admins may not be members of the target org, so the Better
        // Auth invitation handler (which requires an active membership) would
        // reject the call with a 500. Insert the invitation row directly,
        // matching the schema produced by the organization plugin.
        const normalizedEmail = email.toLowerCase();
        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

        type CreatedInvitation = {
          id: string;
          email: string;
          role: string;
          status: string;
          expiresAt: Date;
        };

        let created: CreatedInvitation;
        try {
          // SERIALIZABLE isolation ensures parallel callers cannot both
          // pass the existence check; the second commit raises 40001
          // (serialization_failure) and we retry once before surfacing
          // the duplicate to the client as 409. PG error code 23505 is
          // also handled as a fallback for a future UNIQUE constraint
          // on (email, organization_id, status).
          const runTx = () =>
            db.transaction(
              async (tx) => {
                const existing = await tx
                  .select({ id: invitation.id })
                  .from(invitation)
                  .where(
                    and(
                      eq(invitation.email, normalizedEmail),
                      eq(invitation.organizationId, organizationId),
                      eq(invitation.status, "pending")
                    )
                  )
                  .limit(1);

                if (existing[0]) {
                  throw new Error("DUPLICATE_PENDING_INVITATION");
                }

                const inserted = await tx
                  .insert(invitation)
                  .values({
                    id: randomUUID(),
                    email: normalizedEmail,
                    inviterId: usr.id,
                    organizationId,
                    role,
                    status: "pending",
                    expiresAt,
                  })
                  .returning({
                    id: invitation.id,
                    email: invitation.email,
                    role: invitation.role,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                  });

                const row = inserted[0];
                if (!row) {
                  throw new Error("INSERT_RETURNED_EMPTY");
                }
                return row;
              },
              { isolationLevel: "serializable" }
            );

          const maxAttempts = 5;
          let attempt = 0;
          while (true) {
            try {
              created = await runTx();
              break;
            } catch (err) {
              const pgCode = (err as { code?: string } | null)?.code;
              attempt++;
              if (pgCode === "40001" && attempt < maxAttempts) {
                // Serialization conflict from a concurrent insert.
                // Retry with small backoff; the retry's existence check
                // now sees the row committed by the winner and surfaces
                // a clean duplicate-detection 409.
                await new Promise((resolve) =>
                  setTimeout(resolve, 10 + Math.random() * 20)
                );
                continue;
              }
              throw err;
            }
          }
        } catch (err) {
          const pgCode = (err as { code?: string } | null)?.code;
          if (
            (err instanceof Error &&
              err.message === "DUPLICATE_PENDING_INVITATION") ||
            pgCode === "23505"
          ) {
            return reply.status(409).send({
              success: false as const,
              message:
                "A pending invitation already exists for this email in this organization.",
            });
          }
          request.log.error({ err }, "createInvitation (platform admin) failed");
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create invitation",
          });
        }

        // Better Auth's sendInvitationEmail hook only fires through
        // auth.api.createInvitation, which we bypassed above. Dispatch
        // the email manually so the invitee gets a link.
        try {
          const [orgRow] = await db
            .select({ name: organization.name })
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);
          const [inviterRow] = await db
            .select({ name: user.name })
            .from(user)
            .where(eq(user.id, usr.id))
            .limit(1);

          await sendInvitationEmail({
            to: created.email,
            organizationName: orgRow?.name ?? "your organization",
            invitationId: created.id,
            inviterName: inviterRow?.name ?? undefined,
            expiresAt: created.expiresAt,
            role: created.role,
          });
        } catch (err) {
          // Idempotent: invitation row exists. Surface in logs so the
          // operator can re-send; do not fail the request.
          request.log.error(
            { err, invitationId: created.id },
            "sendInvitationEmail (platform admin) failed"
          );
        }

        return reply.status(201).send({
          success: true as const,
          data: {
            id: created.id,
            email: created.email,
            role: created.role,
            status: created.status,
            expiresAt: created.expiresAt.toISOString(),
          },
        });
      }

      const headers = getRequestHeaders(request);
      try {
        const result = await auth.api.createInvitation({
          body: {
            email,
            role,
            organizationId,
            resend: true,
          },
          headers,
        });

        if (!result) {
          return reply.status(400).send({
            success: false as const,
            message: "Failed to create invitation",
          });
        }

        const data = result as {
          id?: string;
          email?: string;
          role?: string;
          status?: string;
          expiresAt?: Date;
        };
        return reply.status(201).send({
          success: true as const,
          data: {
            id: data.id ?? "",
            email: data.email ?? email,
            role: data.role ?? role,
            status: data.status ?? "pending",
            expiresAt:
              data.expiresAt instanceof Date ? data.expiresAt.toISOString() : "",
          },
        });
      } catch (err) {
        const error = err as {
          statusCode?: number;
          status?: number;
          body?: { message?: string; code?: string };
          message?: string;
        };
        const rawStatus =
          typeof error.statusCode === "number" && error.statusCode >= 400
            ? error.statusCode
            : typeof error.status === "number" && error.status >= 400
              ? error.status
              : 400;
        const rawMessage =
          error.body?.message ?? error.message ?? "Failed to create invitation";
        // Better Auth surfaces duplicate-pending / already-a-member as
        // BAD_REQUEST (400). These are conflict-class errors and should
        // be normalized to 409, mirroring addExistingMember's mapping.
        if (/already invited|pending invitation already exists/i.test(rawMessage)) {
          request.log.error({ err }, "createInvitation failed (duplicate)");
          return reply.status(409).send({
            success: false as const,
            message:
              "A pending invitation already exists for this email in this organization.",
          });
        }
        if (/already a member/i.test(rawMessage)) {
          request.log.error({ err }, "createInvitation failed (already member)");
          return reply.status(409).send({
            success: false as const,
            message: "User is already a member of this organization.",
          });
        }
        request.log.error({ err }, "createInvitation failed");
        return reply.status(rawStatus).send({
          success: false as const,
          message: rawMessage,
        });
      }
    }
  );
}
