import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema400 } from "../../_responses/types";
import { aiClient } from "../../../../lib/ai-client";
import { db } from "@repo/infra/db";
import * as schema from "@repo/infra/db/schema";
import { eq, and } from "drizzle-orm";

const ChatRequestSchema = z.object({
  workSessionId: z.string(),
  code: z.string(),
  language: z.string(),
  message: z.string().min(1),
  guardrailPreset: z.enum(["loose", "medium", "strict"]).optional().default("medium"),
});

const ChatResponseSchema = ResponseSchema200.extend({
  data: z.object({
    response: z.string(),
    suggestions: z.array(z.string()),
  }),
});

const ErrorResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * AI chat endpoint for frontend to get code hints.
 * Gathers full context from the database and sends to the AI service.
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
          401: ErrorResponse,
          404: ErrorResponse,
          500: ErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { workSessionId, code, language, message, guardrailPreset } = request.body;

      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      try {
        // 1. Get work session (includes challengeId and teachingAssistantId)
        const session = await db.query.workSession.findFirst({
          where: and(
            eq(schema.workSession.id, workSessionId),
            eq(schema.workSession.userId, userId),
          ),
        });

        if (!session) {
          return reply.status(404).send({
            success: false,
            message: "Work session not found",
          });
        }

        // 2. Get challenge details
        const challengeData = await db.query.challenge.findFirst({
          where: eq(schema.challenge.id, session.challengeId),
        });

        if (!challengeData) {
          return reply.status(404).send({
            success: false,
            message: "Challenge not found",
          });
        }

        // 3. Get teaching assistant
        const ta = await db.query.teachingAssistant.findFirst({
          where: eq(schema.teachingAssistant.id, session.teachingAssistantId),
        });

        if (!ta) {
          return reply.status(404).send({
            success: false,
            message: "Teaching assistant not found",
          });
        }

        // 4. Get knowledge base entries for this challenge
        const kbEntries = await db
          .select({ content: schema.knowledgeBase.content })
          .from(schema.knowledgeBase)
          .where(eq(schema.knowledgeBase.challengeId, session.challengeId));

        // 5. Get recent chat history for this work session (limit to prevent unbounded growth)
        const history = await db
          .select({
            userPrompt: schema.userInteractionOnChallenge.userPrompt,
            modelResponse: schema.userInteractionOnChallenge.modelResponse,
          })
          .from(schema.userInteractionOnChallenge)
          .where(eq(schema.userInteractionOnChallenge.workSessionId, workSessionId))
          .orderBy(schema.userInteractionOnChallenge.createdAt)
          .limit(20);

        // 6. Build chat history array
        const chatHistory = history.flatMap(h => [
          { role: "user", content: h.userPrompt },
          { role: "assistant", content: h.modelResponse },
        ]);

        // 7. Call AI service with complete context
        const aiResponse = await aiClient.sendChatRequest({
          code,
          language,
          message,
          exercise: {
            title: challengeData.title,
            description: challengeData.description,
            supportMaterials: challengeData.supportMaterials,
            possibleSolutions: challengeData.possibleSolutions,
          },
          teaching_assistant: {
            systemPrompt: ta.systemPrompt,
            targetAudience: ta.targetAudience,
          },
          knowledge_base: kbEntries.map(kb => kb.content),
          chat_history: chatHistory,
          guardrailPreset,
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
