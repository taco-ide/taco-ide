import { z } from "zod";

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must have at least 6 characters"),
  turnstileToken: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Verification schema (2FA)
export const verificationSchema = z.object({
  code: z.string().length(6, "Code must have 6 digits"),
});

export type VerificationFormData = z.infer<typeof verificationSchema>;

// Request password reset schema
export const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email"),
  turnstileToken: z.string().optional(),
});

export type RequestPasswordResetFormData = z.infer<
  typeof requestPasswordResetSchema
>;

// Reset password schema
export const resetPasswordSchema = z
  .object({
    code: z.string().length(6, "Code must have 6 digits").optional(),
    password: z.string().min(6, "Password must have at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Password must have at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Signup schema
export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must have at least 2 characters"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must have at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Password must have at least 6 characters"),
    turnstileToken: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;
