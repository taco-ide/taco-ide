import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    env.BETTER_AUTH_URL,
  ],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
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
    requireEmailVerification: true,

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
      roleId: {
        type: "number",
        required: false,
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
