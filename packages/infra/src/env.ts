import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  // Frontend URL for redirects
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@taco-ide.com"),

  // Cloudflare Turnstile (optional)
  CLOUDFLARE_TURNSTILE_SECRET: z.string().optional(),

  // AI Service
  AI_SERVICE_URL: z.string().url().default("http://ai-service:8000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
