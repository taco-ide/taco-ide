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
  FRONTEND_URL: z.string().url().default("http://localhost:4001"),

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

  // LLM (AI Agents - LangGraph.js)
  LLM_API_BASE: z
    .string()
    .url()
    .default("https://taco-ide-resource.openai.azure.com/openai/v1/"),
  // Azure OpenAI deployment name — must match a deployed model in the Azure resource
  LLM_MODEL_NAME: z.string().default("gpt-4o-mini"),
  LLM_API_KEY: z.string(),
  CODE_EXEC_API_URL: z
    .string()
    .url()
    .default("https://emkc.org/api/v2/piston/execute"),

  // Langfuse observability (optional)
  LANGFUSE_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASEURL: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => v || undefined),

  // Server
  PORT: z.coerce.number().default(3344),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
