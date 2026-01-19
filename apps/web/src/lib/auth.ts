// Re-export Better Auth client from infra package
export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  forgetPassword,
  resetPassword,
} from "@repo/infra/auth/client";
