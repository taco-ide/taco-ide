import type { FastifyReply, FastifyRequest } from "fastify";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 25;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function getBucketKey(req: FastifyRequest): string | null {
  const usr = req.user;
  if (!usr) return null;
  const id = (req.params as { id?: string }).id;
  const body = req.body as
    | { workSessionId?: string; classroomId?: string }
    | undefined;
  const resourceId =
    id ?? body?.workSessionId ?? `teacher:${body?.classroomId ?? ""}`;
  return `${usr.id}:${resourceId}`;
}

/**
 * In-memory rate limit shared by JSON and SSE chat (per user + resource).
 */
export async function workSessionChatRateLimitPreHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const key = getBucketKey(request);
  if (!key) return;

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS) {
    return reply.status(429).send({
      success: false as const,
      message: "Too many chat messages. Please wait a moment and try again.",
    });
  }
}
