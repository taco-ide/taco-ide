/**
 * API rate limiting (issue #14).
 *
 * Two layers, both backed by @fastify/rate-limit's in-memory LRU store:
 *
 * 1. Global default — every route (except the Better Auth bridge, which has
 *    its own per-IP limits) shares one budget per user, or per client IP
 *    for anonymous requests: RATE_LIMIT_GLOBAL_PER_MINUTE.
 * 2. Cost policies — routes that spend LLM or embedding tokens add
 *    `rateLimitPolicy(...)` as a preHandler. Each policy has a per-minute and
 *    a per-day budget per user, shared by every route in that policy (a user's
 *    budget does not grow with the number of sessions or classrooms):
 *      - aiChat:       teaching assistant / teacher's companion chat
 *      - aiGeneration: reference solutions and auto-review re-runs
 *      - embedding:    knowledge base search, manual entries, document upload
 *
 * Exceeded limits answer 429 with Retry-After, x-ratelimit-* headers and
 * `{ success: false, message, code: "RATE_LIMITED", retryAfterSeconds }`.
 *
 * Set RATE_LIMIT_ENABLED=false to turn both layers off. The store is per
 * process: with more than one API instance, add
 * `redis: new Redis(env.REDIS_URL)` to `globalRateLimitOptions`; no route
 * changes are needed.
 */
import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "@repo/infra/env";

export type RateLimitPolicy = "aiChat" | "aiGeneration" | "embedding";

type Budget = { perMinute: number; perDay: number };

/**
 * Current limits, read on every request. Initialised from the environment;
 * tests may lower them temporarily to exercise the 429 path.
 */
export const rateLimitSettings: {
  globalPerMinute: number;
} & Record<RateLimitPolicy, Budget> = {
  globalPerMinute: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
  aiChat: {
    perMinute: env.RATE_LIMIT_AI_CHAT_PER_MINUTE,
    perDay: env.RATE_LIMIT_AI_CHAT_PER_DAY,
  },
  aiGeneration: {
    perMinute: env.RATE_LIMIT_AI_GENERATION_PER_MINUTE,
    perDay: env.RATE_LIMIT_AI_GENERATION_PER_DAY,
  },
  embedding: {
    perMinute: env.RATE_LIMIT_EMBEDDING_PER_MINUTE,
    perDay: env.RATE_LIMIT_EMBEDDING_PER_DAY,
  },
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const POLICY_MESSAGES: Record<RateLimitPolicy, string> = {
  aiChat: "Too many chat messages. Please wait and try again.",
  aiGeneration: "Too many AI generation requests. Please wait and try again.",
  embedding: "Too many knowledge base requests. Please wait and try again.",
};
const GLOBAL_MESSAGE = "Too many requests. Please wait and try again.";

export const RATE_LIMITED_CODE = "RATE_LIMITED";

/** Error the global limiter throws; the app error handler serialises it. */
export class RateLimitExceededError extends Error {
  readonly statusCode = 429;
  readonly code = RATE_LIMITED_CODE;
  constructor(
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
  }
}

export function rateLimitBody(message: string, retryAfterSeconds: number) {
  return {
    success: false as const,
    message,
    code: RATE_LIMITED_CODE,
    retryAfterSeconds,
  };
}

function rateLimitKey(request: FastifyRequest): string {
  return request.user ? `user:${request.user.id}` : `ip:${request.ip}`;
}

type Limiter = ReturnType<FastifyInstance["createRateLimit"]>;

/**
 * Options for the app-wide registration in server.ts. Register the plugin
 * before the routes so its onRoute hook sees them. The route-level onRequest
 * hook it adds runs after the app-level auth hook, so request.user is
 * already set when the key is built.
 */
export const globalRateLimitOptions: RateLimitPluginOptions = {
  global: true,
  max: () => rateLimitSettings.globalPerMinute,
  timeWindow: MINUTE_MS,
  keyGenerator: rateLimitKey,
  hook: "onRequest",
  errorResponseBuilder: (_request, context) =>
    new RateLimitExceededError(GLOBAL_MESSAGE, Math.ceil(context.ttl / 1000)),
};

// Policy limiters are created on first use from the plugin's decorator, one
// store per policy and window, shared by every route in the policy.
let policyLimiters: {
  factory: FastifyInstance["createRateLimit"];
  byPolicy: Partial<Record<RateLimitPolicy, Limiter[]>>;
} | null = null;

function limitersFor(
  server: FastifyInstance,
  policy: RateLimitPolicy
): Limiter[] | null {
  // Undefined when the plugin is not registered (RATE_LIMIT_ENABLED=false).
  const factory = server.createRateLimit as
    | FastifyInstance["createRateLimit"]
    | undefined;
  if (!factory) return null;
  if (policyLimiters?.factory !== factory) {
    policyLimiters = { factory, byPolicy: {} };
  }
  return (policyLimiters.byPolicy[policy] ??= [
    factory({
      max: () => rateLimitSettings[policy].perMinute,
      timeWindow: MINUTE_MS,
      keyGenerator: rateLimitKey,
    }),
    factory({
      max: () => rateLimitSettings[policy].perDay,
      timeWindow: DAY_MS,
      keyGenerator: rateLimitKey,
    }),
  ]);
}

/**
 * preHandler enforcing a cost policy. Runs after auth and validation, so
 * malformed requests are rejected without spending budget. `when` limits
 * the check to requests that actually trigger the costly work.
 */
export function rateLimitPolicy(
  policy: RateLimitPolicy,
  options: { when?: (request: FastifyRequest) => boolean } = {}
) {
  return async function rateLimitPolicyPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (options.when && !options.when(request)) return;
    const limiters = limitersFor(request.server, policy);
    if (!limiters) return;

    // Minute window first: a burst rejected there does not use daily budget.
    for (const limiter of limiters) {
      const result = await limiter(request);
      if (result.isAllowed) continue;
      if (!result.isExceeded) continue;

      return reply
        .status(429)
        .header("x-ratelimit-limit", result.max)
        .header("x-ratelimit-remaining", 0)
        .header("x-ratelimit-reset", result.ttlInSeconds)
        .header("retry-after", result.ttlInSeconds)
        .send(rateLimitBody(POLICY_MESSAGES[policy], result.ttlInSeconds));
    }
  };
}
