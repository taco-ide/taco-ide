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
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3344",
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
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  resetPassword,
  requestPasswordReset,
} = authClient;

// Re-export RBAC helpers and types for frontend usage
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
