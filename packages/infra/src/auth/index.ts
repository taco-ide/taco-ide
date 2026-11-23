import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { sendInvitationEmail } from "./invitation-email";
import { applyEmailDomainRule } from "./email-domain-membership";
import {
  rejectAdministrativeUserFields,
  requireActiveAccount,
  requireActivePlatformAdmin,
} from "./boundaries";
import {
  ac,
  studentRole,
  teacherRole,
  coordinatorRole,
  adminRole,
} from "./permissions";

// Re-export permissions for consumers
export { ac, studentRole, teacherRole, coordinatorRole, adminRole } from "./permissions";
export {
  hasMinimumRole,
  roleHasPermission,
  isValidRole,
  getAllRoles,
} from "./permissions";
export type {
  RoleName,
  Resource,
  ActionFor,
  Action,
  Permission,
} from "./permissions";

// Re-export the Better Auth scrypt-based password hasher so consumers
// (e.g. seeds, bulk import routes) can produce credentials compatible
// with email/password sign-in without depending on `better-auth`
// directly.
export { hashPassword } from "better-auth/crypto";

// Re-export APIError so the API can map Better Auth errors (401/403/...)
// to clean HTTP responses without depending on `better-auth` directly.
export { APIError } from "better-auth/api";

/**
 * Accepting an expired invitation fails inside Better Auth before any
 * organization hook runs, so the fallback to the email-domain rule (which the
 * pending invitation held back at sign-up) happens here, before the accept.
 */
async function applyEmailDomainRuleIfInvitationExpired(
  ctx: Parameters<typeof getSessionFromCtx>[0]
): Promise<void> {
  try {
    const invitationId = (ctx.body as { invitationId?: unknown } | undefined)
      ?.invitationId;
    if (typeof invitationId !== "string") return;
    const session = await getSessionFromCtx(ctx);
    if (!session) return;

    const [expired] = await db
      .select({ id: schema.invitation.id })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.id, invitationId),
          eq(schema.invitation.status, "pending"),
          lte(schema.invitation.expiresAt, new Date()),
          eq(
            sql`lower(${schema.invitation.email})`,
            session.user.email.toLowerCase()
          )
        )
      )
      .limit(1);
    if (expired) await applyEmailDomainRule(session.user);
  } catch (err) {
    // Never block the accept call itself; Better Auth reports the expiry.
    console.error("[accept-invitation] domain auto-assign failed:", err);
  }
}

// ==================== AUTH INSTANCE ====================

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL, env.BETTER_AUTH_URL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  // Email verification configuration
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Replace relative callbackURL with absolute frontend URL
      const verificationUrl = new URL(url);
      const callbackPath = verificationUrl.searchParams.get("callbackURL") || "/explore";
      // Ensure callbackURL points to frontend
      const absoluteCallbackURL = callbackPath.startsWith("http")
        ? callbackPath
        : `${env.FRONTEND_URL}${callbackPath}`;
      verificationUrl.searchParams.set("callbackURL", absoluteCallbackURL);

      await sendVerificationEmail({
        to: user.email,
        verificationUrl: verificationUrl.toString(),
        userName: user.name ?? user.email.split("@")[0] ?? "User",
      });
    },
  },

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.NODE_ENV === "production",

    // Send password reset email
    sendResetPassword: async ({ user, url }) => {
      // Replace relative redirectTo with absolute frontend URL
      const resetUrl = new URL(url);
      const redirectPath = resetUrl.searchParams.get("callbackURL") || "/auth/reset-password";
      // Ensure redirectTo points to frontend
      const absoluteRedirectURL = redirectPath.startsWith("http")
        ? redirectPath
        : `${env.FRONTEND_URL}${redirectPath}`;
      resetUrl.searchParams.set("callbackURL", absoluteRedirectURL);

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: resetUrl.toString(),
        userName: user.name ?? user.email.split("@")[0] ?? "User",
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },

  user: {
    additionalFields: {
      isActive: {
        type: "boolean",
        defaultValue: true,
        required: false,
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
      // input: false prevents clients from setting isPlatformAdmin during
      // sign-up or self-update. Promotion is done server-side only.
      isPlatformAdmin: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/organization/accept-invitation") {
        await applyEmailDomainRuleIfInvitationExpired(ctx);
        return;
      }
      if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;

      // Reject every supplied value, including false/null. input:false alone
      // may ignore such values or substitute a default during sign-up.
      rejectAdministrativeUserFields(ctx.body);

      if (ctx.path !== "/update-user") return;
      const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
      if (!session) {
        throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
      }
      await requireActiveAccount(session.user.id);
    }),
  },

  plugins: [
    organization({
      ac,
      roles: {
        student: studentRole,
        teacher: teacherRole,
        coordinator: coordinatorRole,
        admin: adminRole,
        owner: adminRole,
        member: studentRole,
      },
      allowUserToCreateOrganization: async (user) => {
        // Read current privileges from the database, never cached user claims.
        // Throw instead of returning false so server-side userId calls cannot
        // bypass the same platform-admin policy through the plugin.
        await requireActivePlatformAdmin(user.id);
        return true;
      },
      creatorRole: "admin",
      organizationHooks: {
        // A pending invitation holds back the email-domain rule at sign-up;
        // once it is declined, fall back to the rule so the person still
        // lands in an organization.
        afterRejectInvitation: async ({ user }) => {
          try {
            await applyEmailDomainRule(user);
          } catch (err) {
            console.error(
              "[organization.afterRejectInvitation] domain auto-assign failed:",
              err
            );
          }
        },
      },
      sendInvitationEmail: async (data) => {
        try {
          await sendInvitationEmail({
            to: data.email,
            organizationName: data.organization.name,
            invitationId: data.id,
            inviterName: data.inviter.user.name ?? undefined,
            expiresAt: data.invitation.expiresAt,
            role: data.role,
          });
        } catch (err) {
          console.error(
            "[organization.sendInvitationEmail] failed:",
            err
          );
          // Swallow: the invitation row already exists; the user can be
          // re-notified later. Throwing here would abort the create call.
        }
      },
    }),
  ],

  // Database hooks run inside Better Auth's create/update transactions.
  // Throwing here aborts the user creation, so we always swallow errors
  // in the auto-assignment hook and prefer a successful sign-up over a
  // brittle one-shot membership.
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          try {
            if (typeof createdUser.email !== "string") return;
            await applyEmailDomainRule(createdUser);
          } catch (err) {
            console.error(
              "[user.create.after] domain auto-assign failed:",
              err
            );
            // Do NOT rethrow — failing the hook would roll back the user
            // creation. Better: user signs up successfully, just without
            // the auto-assignment.
          }
        },
      },
    },
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === "production",
    },
  },
});

// Export types
export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
