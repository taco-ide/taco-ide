import type { FastifyRequest } from "fastify";

/**
 * Convert Fastify request headers to Web API Headers for Better Auth.
 */
export function getRequestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    }
  }
  return headers;
}
