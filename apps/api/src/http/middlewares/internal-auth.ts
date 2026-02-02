import { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@repo/infra/env";

/**
 * Middleware to validate internal service-to-service authentication
 * Used for endpoints that should only be called by the AI service
 */
export async function internalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const internalSecret = request.headers["x-internal-secret"];

  if (!internalSecret || internalSecret !== env.INTERNAL_API_SECRET) {
    return reply.status(401).send({
      success: false,
      message: "Unauthorized: Invalid internal secret",
    });
  }
}
