import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema400 } from "../../_responses/types";
import { aiClient } from "../../../../lib/ai-client";

const ChatRequestSchema = z.object({
  exerciseId: z.number().int().positive(),
  code: z.string(),
  language: z.string(),
  message: z.string().min(1),
});

const ChatResponseSchema = ResponseSchema200.extend({
  data: z.object({
    response: z.string(),
    suggestions: z.array(z.string()),
  }),
});

/**
 * AI chat endpoint for frontend to get code hints.
 * Proxies requests to the Python AI service.
 */
export async function chatRoute(app: FastifyTypedInstance) {
  app.post(
    "/chat",
    {
      schema: {
        tags: ["ai"],
        description: "Get AI-powered code hints and suggestions",
        body: ChatRequestSchema,
        response: {
          200: ChatResponseSchema,
          400: ResponseSchema400,
        },
      },
    },
    async (request, reply) => {
      const { exerciseId, code, language, message } = request.body;

      // Get user ID from authenticated session
      // @ts-expect-error - user is attached by authMiddleware
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: "Unauthorized: User not authenticated",
        });
      }

      try {
        // Call AI service
        const aiResponse = await aiClient.sendChatRequest({
          exercise_id: exerciseId,
          code,
          language,
          message,
          user_id: userId,
        });

        return reply.send({
          success: true,
          data: {
            response: aiResponse.response,
            suggestions: aiResponse.suggestions,
          },
        });
      } catch (error) {
        console.error("AI service error:", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to get AI response. Please try again.",
        });
      }
    }
  );
}
