import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
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
      },
      deletedAt: {
        type: "date",
        required: false,
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
      allowUserToCreateOrganization: true,
      creatorRole: "admin",
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
            const email = createdUser.email;
            if (typeof email !== "string") return;
            // Use lastIndexOf("@") to handle quoted local parts like
            // `"user@name"@example.com` — split("@")[1] would return the
            // wrong portion in that (rare, but valid per RFC 5321) case.
            const atIndex = email.lastIndexOf("@");
            if (atIndex === -1) return;
            const domain = email.slice(atIndex + 1).toLowerCase().trim();
            if (!domain) return;

            // Pick the earliest active rule (createdAt ASC). Multiple rules
            // for the same domain across different organizations are allowed
            // by the global UNIQUE(domain, role) only when the role differs;
            // we still tiebreak by createdAt for predictability.
            const rules = await db
              .select({
                id: schema.organizationEmailDomain.id,
                organizationId: schema.organizationEmailDomain.organizationId,
                role: schema.organizationEmailDomain.role,
                createdAt: schema.organizationEmailDomain.createdAt,
              })
              .from(schema.organizationEmailDomain)
              .innerJoin(
                schema.organization,
                eq(
                  schema.organization.id,
                  schema.organizationEmailDomain.organizationId
                )
              )
              .where(
                and(
                  eq(schema.organizationEmailDomain.domain, domain),
                  eq(schema.organization.isActive, true)
                )
              )
              .orderBy(asc(schema.organizationEmailDomain.createdAt))
              .limit(1);

            const rule = rules[0];
            if (!rule) return;

            // Insert the membership directly via Drizzle. Going through
            // `auth.api.addMember` would enforce the org plugin's
            // `membershipLimit` (default 100); we want auto-assignment to
            // bypass that for new sign-ups.
            await db.insert(schema.member).values({
              id: randomUUID(),
              userId: createdUser.id,
              organizationId: rule.organizationId,
              role: rule.role,
              createdAt: new Date(),
            });
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
