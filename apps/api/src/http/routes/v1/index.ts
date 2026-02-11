import { FastifyTypedInstance } from "../../types";
import { authRoutes, apiAuthRoutes } from "./auth/index";
import { statusRoutes } from "./status/index";
import { usersRoutes } from "./users/index";
import { chatRoutes } from "./chat/index";

const routes = [authRoutes, statusRoutes, usersRoutes, chatRoutes] as const;

export async function registerRoutes(app: FastifyTypedInstance) {
  // Register /api/auth/* routes for Better Auth client compatibility
  await app.register(apiAuthRoutes, { prefix: "/api" });

  // Register /v1/* routes
  for (const route of routes) {
    await app.register(route, {
      prefix: "/v1",
    });
  }
}
