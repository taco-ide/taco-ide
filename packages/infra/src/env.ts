import { z } from "zod";

/**
 * Parses TRUST_PROXY into Fastify's `trustProxy` option: the reverse proxies
 * whose X-Forwarded-For entries the API believes. Unset, empty or "false"
 * trust none (client IP = socket address). Otherwise a comma-separated list
 * of proxy IPs/CIDRs, or proxy-addr's named ranges ("loopback", "linklocal",
 * "uniquelocal"). The client IP is then the rightmost X-Forwarded-For entry
 * not added by a trusted proxy, so entries a client puts in the header itself
 * are ignored.
 *
 * "true" is rejected: it trusts the leftmost entry, which the client chooses.
 * Hop counts are rejected too: Fastify 5 treats a numeric trustProxy as
 * "trust nothing" because it cannot check that the peer really is a proxy.
 */
export function parseTrustProxy(value: string | undefined): false | string[] {
  const v = value?.trim() ?? "";
  if (v === "" || v === "false") return false;
  if (v === "true" || /^\d+$/.test(v)) {
    throw new Error(
      "TRUST_PROXY must list the proxy addresses (e.g. 127.0.0.1, 10.0.0.0/8 or uniquelocal); true and hop counts are not supported"
    );
  }
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  // OpenRouter (LLM) — fallback for reference solutions and auto-review
  // whenever the PDC API is disabled or fails.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_FALLBACK_MODEL: z.string().default("openai/gpt-6-luna"),

  // PDC workflow_taco API (reference solutions + auto-review). Without a URL
  // both generators go straight to the OpenRouter fallback. Keep the URL out
  // of versioned files: the partner asked for it not to be shared.
  PDC_API_URL: z.string().url().optional(),
  PDC_GABARITO_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  PDC_REVIEW_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

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
  PORT: z.coerce.number().default(4000),

  // Reverse proxies whose X-Forwarded-For the API trusts when resolving the
  // client IP (rate limits, Better Auth). Default: none. In production set
  // the proxy's address, e.g. 127.0.0.1 for nginx on the same host or
  // uniquelocal for a proxy on a private (Docker) network. See parseTrustProxy.
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v, ctx) => {
      try {
        return parseTrustProxy(v);
      } catch (err) {
        ctx.addIssue({ code: "custom", message: (err as Error).message });
        return z.NEVER;
      }
    }),

  // API rate limits (in-memory, per process). Authenticated requests are
  // counted per user, anonymous ones per client IP. See
  // apps/api/src/http/middlewares/rate-limit.ts for what each budget covers.
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AI_CHAT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AI_CHAT_PER_DAY: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_AI_GENERATION_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  RATE_LIMIT_AI_GENERATION_PER_DAY: z.coerce
    .number()
    .int()
    .positive()
    .default(100),
  RATE_LIMIT_EMBEDDING_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  RATE_LIMIT_EMBEDDING_PER_DAY: z.coerce.number().int().positive().default(500),
  // Entries per limiter store (LRU). When more keys than this are active in
  // a window, the least recently used are evicted and their counts reset.
  RATE_LIMIT_CACHE_SIZE: z.coerce.number().int().positive().default(10000),

  // Better Auth rate limits (per client IP and auth path). Disabled by
  // default under NODE_ENV=test so suites can sign in freely. Better Auth's
  // counter resets only after a full window passes without an allowed
  // request, so a limit is per burst of activity, not per calendar window:
  // once it is reached, the IP waits until one window after its last allowed
  // request.
  AUTH_RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) =>
      v === undefined ? process.env.NODE_ENV !== "test" : v === "true"
    ),
  AUTH_RATE_LIMIT_SIGN_IN_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(100),
  AUTH_RATE_LIMIT_EMAIL_PER_HOUR: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  // Platform admin seed (all optional; seed skips with a warning if any is missing)
  PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().min(12).optional(),
  PLATFORM_ADMIN_NAME: z.string().min(2).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
