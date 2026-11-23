import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema429,
  ResponseSchema500,
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { env } from "@repo/infra/env";
import { workSession, teachingAssistant, challenge } from "@repo/infra/db/schema";
import type { BaseMessage } from "@langchain/core/messages";
import { prepareTeachingAssistantTurn } from "../../../../agents/teaching-assistant/prepare-turn";
import {
  buildTurnContext,
  finalAnswerText,
  persistTurn,
} from "../../../../agents/teaching-assistant/turn-context";
import { getLangfuseCallback } from "../../../../agents/langfuse";
import { workSessionChatRateLimitPreHandler } from "../../../middlewares/work-session-chat-rate-limit";
import {
  assertCanParticipateInChallengeWorkSession,
  loadChallengeWorkAccessContext,
} from "../../../services/work-session-access";
import { AGENT_TIMEOUT_MS, AgentTimeoutError } from "../../../../agents/llm-factory";
import { AGENT_FALLBACK_RESPONSE } from "../../../../agents/constants";

// ==================== SCHEMAS ====================

const ChatParamsSchema = z.object({
  id: z.string().min(1),
});

const ChatBodySchema = z
  .object({
    message: z.string().min(1).max(10000),
    code: z.string().optional(),
    stdin: z.string().optional(),
    stdout: z.string().optional(),
  })
  .strict();

const ChatResponseSchema = ResponseSchema200.extend({
  data: z.object({
    modelResponse: z.string(),
    interactionId: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function chatRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof ChatParamsSchema>;
    Body: z.infer<typeof ChatBodySchema>;
  }>(
    "/:id/chat",
    {
      preHandler: [workSessionChatRateLimitPreHandler],
      schema: {
        tags: ["work-sessions"],
        summary: "Send chat message and get TA response",
        description:
          "Sends a user message to the Teaching Assistant agent, saves the interaction, and returns the AI response",
        params: ChatParamsSchema,
        body: ChatBodySchema,
        response: {
          200: ChatResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          429: ResponseSchema429,
          500: ResponseSchema500,
          503: ResponseSchema503,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id: workSessionId } = request.params;
      const {
        message,
        code: bodyCode,
        stdin: bodyStdin,
        stdout: bodyStdout,
      } = request.body;

      const [session] = await db
        .select({
          id: workSession.id,
          userId: workSession.userId,
          challengeId: workSession.challengeId,
          teachingAssistantId: workSession.teachingAssistantId,
          endedAt: workSession.endedAt,
          archivedAt: workSession.archivedAt,
        })
        .from(workSession)
        .where(eq(workSession.id, workSessionId))
        .limit(1);

      if (!session) {
        return reply.status(404).send({
          success: false as const,
          message: "Work session not found",
        });
      }

      if (session.userId !== usr.id) {
        return reply.status(403).send({
          success: false as const,
          message: "Not authorized to use this work session",
        });
      }

      if (session.archivedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "Work session was reset",
        });
      }

      if (session.endedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "Cannot chat in an ended work session",
        });
      }

      const ctx = await loadChallengeWorkAccessContext(session.challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const participate = await assertCanParticipateInChallengeWorkSession(
        usr,
        ctx
      );
      if (!participate.ok) {
        return reply.status(participate.status).send({
          success: false as const,
          message: participate.message,
        });
      }

      const [ta] = await db
        .select({
          id: teachingAssistant.id,
          systemPrompt: teachingAssistant.systemPrompt,
          targetAudience: teachingAssistant.targetAudience,
          modelId: teachingAssistant.modelId,
        })
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, session.teachingAssistantId))
        .limit(1);

      if (!ta) {
        return reply.status(404).send({
          success: false as const,
          message: "Teaching assistant not found",
        });
      }

      const [ch] = await db
        .select({
          title: challenge.title,
          description: challenge.description,
          supportMaterials: challenge.supportMaterials,
        })
        .from(challenge)
        .where(and(eq(challenge.id, session.challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      const turn = await prepareTeachingAssistantTurn({
        workSessionId,
        userId: usr.id,
        challengeId: session.challengeId,
        ta,
        challenge: ch,
        message,
        body: { code: bodyCode, stdin: bodyStdin, stdout: bodyStdout },
        onPrefetchError: (err) =>
          request.server.log.warn(
            { err },
            "KB search failed during chat, proceeding without RAG"
          ),
      });

      const langfuseCallback = getLangfuseCallback({
        userId: usr.id,
        sessionId: workSessionId,
        tags: ["agent:ta"],
        metadata: { challengeId: session.challengeId, workSessionId },
      });

      let modelResponse: string;
      let wasFallback = false;
      let producedMessages: BaseMessage[] = [];
      try {
        const callbacks = [
          ...turn.callbacks,
          ...(langfuseCallback ? [langfuseCallback] : []),
        ];

        // Use AbortController to enforce timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, AGENT_TIMEOUT_MS);

        let result;
        try {
          result = await turn.agent.invoke(
            { messages: turn.inputMessages },
            {
              configurable: turn.configurable,
              recursionLimit: 25,
              signal: controller.signal,
              callbacks,
            }
          );
        } finally {
          clearTimeout(timeout);
        }

        // The agent state starts with the input messages; the rest is this turn.
        producedMessages = result.messages.slice(turn.inputMessages.length);

        // If the agent returned nothing (e.g. guardrail triggered), use a fallback
        const answer = finalAnswerText(producedMessages);
        wasFallback = !answer;
        modelResponse = answer || AGENT_FALLBACK_RESPONSE;
      } catch (err) {
        if (
          err instanceof AgentTimeoutError ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return reply.status(503).send({
            success: false as const,
            message: "AI response timed out, please try again",
          });
        }
        request.log.error({ err }, "LangGraph agent error");
        return reply.status(500).send({
          success: false as const,
          message: "Internal server error",
        });
      } finally {
        if (langfuseCallback) {
          langfuseCallback.flushAsync().catch((flushErr) => {
            request.log.warn({ err: flushErr }, "Langfuse flush failed");
          });
        }
      }

      const now = new Date(); // single timestamp shared between updatedAt and lastMessageAt
      const interactionId = randomUUID();

      // Only persist the interaction if the model output was not a fallback response
      if (!wasFallback) {
        await persistTurn(
          {
            id: interactionId,
            workSessionId,
            challengeId: session.challengeId,
            interactionType: "chat",
            userPrompt: message,
            modelResponse,
            ...turn.workspace,
          },
          buildTurnContext({
            interactionId,
            appVersion: env.APP_VERSION ?? null,
            teachingAssistantId: ta.id,
            challengeId: session.challengeId,
            systemPrompt: turn.systemPrompt,
            promptContext: turn.promptContext,
            historyInteractionIds: turn.historyInteractionIds,
            prefetch: turn.prefetch,
            collector: turn.collector,
            llm: turn.llm,
            producedMessages,
            langfuseTraceId: langfuseCallback?.getTraceId?.() ?? null,
          })
        );

        await db
          .update(workSession)
          .set({
            updatedAt: now,
            lastMessageAt: now,
          })
          .where(eq(workSession.id, workSessionId));
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          modelResponse,
          interactionId,
        },
      });
    }
  );
}
