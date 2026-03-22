import { FastifyTypedInstance } from "../../types";
import { authRoutes, apiAuthRoutes } from "./auth/index";
import { statusRoutes } from "./status/index";
import { usersRoutes } from "./users/index";
import { challengesRoutes } from "./challenges/index";
import { workSessionsRoutes } from "./work-sessions/index";
import { knowledgeBasesRoutes } from "./knowledge-bases";

const routes = [
  authRoutes,
  statusRoutes,
  usersRoutes,
  challengesRoutes,
  workSessionsRoutes,
  knowledgeBasesRoutes,
] as const;

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
