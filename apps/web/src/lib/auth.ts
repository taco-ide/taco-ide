// Re-export Better Auth client from infra package
export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} from "@repo/infra/auth/client";
