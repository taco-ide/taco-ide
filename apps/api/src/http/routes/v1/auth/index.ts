import { FastifyTypedInstance } from "../../../types";
import { auth } from "@repo/infra/auth";

/**
 * Helper to convert Fastify request to Web Request and handle Better Auth response
 */
async function handleBetterAuth(
  request: { url: string; method: string; headers: unknown; body?: unknown; protocol: string; hostname: string },
  reply: { header: (key: string, value: string) => void; status: (code: number) => void; send: (body: string) => unknown },
  urlPath: string
) {
  const url = new URL(urlPath, `${request.protocol}://${request.hostname}`);

  const webRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers as Record<string, string>,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? JSON.stringify(request.body)
        : undefined,
  });

  const response = await auth.handler(webRequest);

  response.headers.forEach((value: string, key: string) => {
    reply.header(key, value);
  });

  reply.status(response.status);

  const body = await response.text();
  return reply.send(body);
}

/**
 * Routes for /api/auth/* - Direct Better Auth client compatibility
 * This is the standard path that Better Auth client uses
 */
export async function apiAuthRoutes(app: FastifyTypedInstance) {
  app.all("/auth/*", async (request, reply) => {
    return handleBetterAuth(request, reply, request.url);
  });
}

/**
 * Routes for /v1/auth/* - API versioned auth routes
 * Maps to /api/auth/* internally for Better Auth
 */
export async function authRoutes(app: FastifyTypedInstance) {
  // Better Auth handles all auth routes automatically
  // POST /v1/auth/sign-up/email
  // POST /v1/auth/sign-in/email
  // POST /v1/auth/sign-out
  // POST /v1/auth/request-password-reset
  // POST /v1/auth/reset-password
  // GET  /v1/auth/session

  app.all("/auth/*", async (request, reply) => {
    const urlPath = request.url.replace("/v1/auth", "/api/auth");
    return handleBetterAuth(request, reply, urlPath);
  });
}
