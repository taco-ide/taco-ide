import {
  loadChallengeWorkAccessContext,
  assertCanParticipateInChallengeWorkSession,
} from "../../../services/work-session-access";
import { workSessionChatRateLimitPreHandler } from "../../../middlewares/work-session-chat-rate-limit";
import { z } from "zod";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema500,
  ResponseSchema429,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { env } from "@repo/infra/env";
import { workSession, challenge, teachingAssistant } from "@repo/infra/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { prepareTeachingAssistantTurn } from "../../../../agents/teaching-assistant/prepare-turn";
import {
  buildTurnContext,
  persistTurn,
} from "../../../../agents/teaching-assistant/turn-context";
import { getLangfuseCallback } from "../../../../agents/langfuse";
import {
  AGENT_TIMEOUT_MS,
  AgentTimeoutError,
} from "../../../../agents/llm-factory";
import { AGENT_FALLBACK_RESPONSE } from "../../../../agents/constants";
import { formatSSEEvent } from "../../../../agents/sse-events";

// ==================== SCHEMAS ====================

const StudentMessageBodySchema = z.object({
  workSessionId: z.string().uuid(),
  message: z.string().min(1).max(10000),
  currentCode: z.string().max(65536).optional(),
  stdout: z.string().max(65536).optional(),
});

// ==================== ROUTE ====================

export async function studentMessageRoute(app: FastifyTypedInstance) {
  app.post(
    "/student/message",
    {
      preHandler: [workSessionChatRateLimitPreHandler],
      schema: {
        tags: ["chat"],
        summary: "Send a message to the teaching assistant agent (SSE)",
        description:
          "Invokes the LangGraph teaching assistant agent in-process and streams the response as SSE events. " +
          "Persists the interaction to the database on completion.",
        body: StudentMessageBodySchema,
        response: {
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          500: ResponseSchema500,
          429: ResponseSchema429,
        },
      },
    },
    async (request, reply) => {
      const { user } = request;
      if (!user) {
        return reply
          .status(401)
          .send({ success: false as const, message: "Not authenticated" });
      }

      const { workSessionId, message, currentCode, stdout } = request.body;

      // Load work session and verify ownership
      const ws = await db
        .select()
        .from(workSession)
        .where(eq(workSession.id, workSessionId))
        .limit(1);

      if (!ws[0]) {
        return reply
          .status(404)
          .send({ success: false as const, message: "Work session not found" });
      }

      if (ws[0].userId !== user.id) {
        return reply
          .status(403)
          .send({ success: false as const, message: "Not authorized" });
      }

      if (ws[0].endedAt != null) {
        return reply
          .status(400)
          .send({ success: false as const, message: "Work session has ended" });
      }

      const ctx = await loadChallengeWorkAccessContext(ws[0].challengeId);
      if (!ctx)
        return reply
          .status(404)
          .send({ success: false as const, message: "Challenge not found" });
      const access = await assertCanParticipateInChallengeWorkSession(
        user,
        ctx
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      // Load challenge
      const ch = await db
        .select()
        .from(challenge)
        .where(
          and(eq(challenge.id, ws[0].challengeId), isNull(challenge.deletedAt))
        )
        .limit(1);

      if (!ch[0]) {
        return reply
          .status(404)
          .send({ success: false as const, message: "Challenge not found" });
      }

      // Load teaching assistant + model
      const ta = await db
        .select()
        .from(teachingAssistant)
        .where(eq(teachingAssistant.id, ws[0].teachingAssistantId))
        .limit(1);

      if (!ta[0]?.isActive)
        return reply.status(404).send({
          success: false as const,
          message: "Teaching assistant not found",
        });

      const turn = await prepareTeachingAssistantTurn({
        workSessionId,
        userId: user.id,
        challengeId: ws[0].challengeId,
        ta: ta[0],
        challenge: ch[0],
        message,
        body: { code: currentCode, stdout },
        onPrefetchError: (err) =>
          request.log.warn(
            { err },
            "KB search failed during chat, proceeding without RAG"
          ),
      });

      // HTTP status is committed here — all subsequent errors must use the SSE error event type
      const langfuseCallback = getLangfuseCallback({
        userId: user.id,
        sessionId: workSessionId,
        tags: ["agent:ta"],
        metadata: {
          challengeId: ws[0].challengeId,
          workSessionId,
        },
      });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let fullResponse = "";
      let streamErrored = false;
      // Final graph state; streamEvents only exposes it on the root run's end event.
      let finalMessages: BaseMessage[] | undefined;

      try {
        const callbacks = langfuseCallback ? [langfuseCallback] : [];

        // Use AbortController to enforce timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

        try {
          const stream = turn.agent.streamEvents(
            { messages: turn.inputMessages },
            {
              configurable: turn.configurable,
              recursionLimit: 25,
              streamMode: "messages",
              version: "v2",
              signal: controller.signal,
              callbacks,
            }
          );

          // The first event is the root graph's start; its end carries the final state.
          let rootRunId: string | undefined;
          for await (const event of stream) {
            rootRunId ??= event.run_id;
            if (
              event.event === "on_chat_model_stream" &&
              event.data?.chunk?.content
            ) {
              const content =
                typeof event.data.chunk.content === "string"
                  ? event.data.chunk.content
                  : "";

              if (content) {
                fullResponse += content;
                reply.raw.write(formatSSEEvent({ type: "text", content }));
              }
            } else if (
              event.event === "on_chain_end" &&
              event.run_id === rootRunId
            ) {
              const output = event.data?.output as
                | { messages?: BaseMessage[] }
                | undefined;
              if (Array.isArray(output?.messages)) {
                finalMessages = output.messages;
              }
            }
          }

          // If the agent returned nothing (e.g. guardrail triggered), send a fallback
          if (!fullResponse) {
            fullResponse = AGENT_FALLBACK_RESPONSE;
            reply.raw.write(
              formatSSEEvent({ type: "text", content: fullResponse })
            );
          }

          reply.raw.write(
            formatSSEEvent({ type: "done", full_response: fullResponse })
          );
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        streamErrored = true;
        request.log.error({ err }, "Teaching assistant agent error");
        const isTimeout =
          err instanceof AgentTimeoutError ||
          (err instanceof Error && err.name === "AbortError");
        const errorMsg = isTimeout
          ? "AI response timed out, please try again"
          : "Agent invocation failed";
        reply.raw.write(formatSSEEvent({ type: "error", content: errorMsg }));
      } finally {
        try {
          await langfuseCallback?.flushAsync();
        } catch (err) {
          request.log.error({ err }, "Chat observability flush failed");
        }
      }

      try {
        // Persist interaction to DB (skip if fallback response or stream errored mid-flight)
        if (
          fullResponse &&
          fullResponse !== AGENT_FALLBACK_RESPONSE &&
          !streamErrored
        ) {
          const interactionId = randomUUID();
          await persistTurn(
            {
              id: interactionId,
              workSessionId,
              challengeId: ws[0].challengeId,
              interactionType: "chat",
              userPrompt: message,
              modelResponse: fullResponse,
              ...turn.workspace,
            },
            buildTurnContext({
              interactionId,
              appVersion: env.APP_VERSION ?? null,
              teachingAssistantId: ta[0].id,
              challengeId: ws[0].challengeId,
              systemPrompt: turn.systemPrompt,
              promptContext: turn.promptContext,
              historyInteractionIds: turn.historyInteractionIds,
              prefetch: turn.prefetch,
              collector: turn.collector,
              llm: turn.llm,
              // Without the final state, keep at least the streamed answer.
              producedMessages: finalMessages
                ? finalMessages.slice(turn.inputMessages.length)
                : [new AIMessage(fullResponse)],
              langfuseTraceId: langfuseCallback?.getTraceId?.() ?? null,
            })
          );

          const now = new Date();
          await db
            .update(workSession)
            .set({ updatedAt: now, lastMessageAt: now })
            .where(eq(workSession.id, workSessionId));
        }
      } catch (err) {
        request.log.error({ err }, "Chat interaction persistence failed");
        reply.raw.write(
          formatSSEEvent({
            type: "error",
            content: "Unable to save chat interaction",
          })
        );
      } finally {
        reply.raw.end();
      }
    }
  );
}
