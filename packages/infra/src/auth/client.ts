import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import {
  ac,
  studentRole,
  teacherRole,
  coordinatorRole,
  adminRole,
} from "./permissions";

// Create auth client for frontend usage
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333",
  plugins: [
    organizationClient({
      ac,
      roles: {
        student: studentRole,
        teacher: teacherRole,
        coordinator: coordinatorRole,
        admin: adminRole,
        owner: adminRole,
        member: studentRole,
      },
    }),
  ],
});

// Export typed methods
export const { signIn, signUp, signOut, useSession, resetPassword } =
  authClient;

// Request password reset - calls the /api/auth/forget-password endpoint
export const forgetPassword = async ({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo?: string;
}) => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
  const response = await fetch(`${baseURL}/api/auth/forget-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, redirectTo }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      data: null,
      error: {
        message: errorData.message || "Failed to request password reset",
        status: response.status,
      },
    };
  }

  // Better Auth returns empty body on success for security
  return { data: { success: true }, error: null };
};
