import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import type { auth } from "./index";
import {
  ac,
  studentRole,
  teacherRole,
  coordinatorRole,
  adminRole,
} from "./permissions";

// Create auth client for frontend usage.
// Type is intentionally inferred (not annotated) so plugin augmentations like
// `.organization` survive on the public surface. inferAdditionalFields propagates
// custom user fields (e.g. isPlatformAdmin) to the client session type.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  plugins: [
    inferAdditionalFields<typeof auth>(),
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
