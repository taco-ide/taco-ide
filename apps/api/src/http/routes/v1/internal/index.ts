import { FastifyTypedInstance } from "../../../types";
import { internalAuthMiddleware } from "../../../middlewares/internal-auth";
import { getExerciseRoute } from "./exercises";
import { getRecentSubmissionsRoute } from "./submissions";

/**
 * Internal API routes - for use by AI service only
 * All routes are protected by internal auth middleware
 */
export async function internalRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify) => {
      // Apply internal auth middleware to all routes in this group
      fastify.addHook("onRequest", internalAuthMiddleware);

      // Register exercise routes
      await fastify.register(
        async (exerciseApp) => {
          await getExerciseRoute(exerciseApp);
        },
        { prefix: "/exercises" }
      );

      // Register submission routes
      await fastify.register(
        async (submissionApp) => {
          await getRecentSubmissionsRoute(submissionApp);
        },
        { prefix: "/submissions" }
      );
    },
    { prefix: "/internal" }
  );
}
