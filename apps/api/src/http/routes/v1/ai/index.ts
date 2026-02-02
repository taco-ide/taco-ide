import { FastifyTypedInstance } from "../../../types";
import { chatRoute } from "./chat";

/**
 * AI routes - for frontend to access AI features.
 * These routes proxy requests to the Python AI service.
 */
export async function aiRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify) => {
      await chatRoute(fastify);
    },
    { prefix: "/ai" }
  );
}
