import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";

// ==================== SCHEMAS ====================

const StatusResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
});

// ==================== ROUTE ====================

export async function statusRoutes(app: FastifyTypedInstance) {
  app.get(
    "/status",
    {
      schema: {
        tags: ["status"],
        summary: "Health check endpoint",
        description: "Returns the API health status and uptime",
        response: {
          200: StatusResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        success: true as const,
        message: "API is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }
  );
}
