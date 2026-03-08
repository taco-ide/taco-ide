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

  // OpenRouter (LLM)
  OPENROUTER_API_KEY: z.string().optional(),

  // Embedding
  EMBEDDING_PROVIDER: z.enum(["openai", "azure"]).optional(),
  EMBEDDING_API_URL: z.string().url().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  // Server
  PORT: z.coerce.number().default(3344),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
