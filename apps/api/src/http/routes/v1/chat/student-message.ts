import { z } from "zod";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema500,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  challenge,
  teachingAssistant,
  model,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildTeachingAssistantAgent } from "../../../../agents/teaching-assistant/agent";
import { buildTeachingAssistantPrompt } from "../../../../agents/teaching-assistant/prompt";
import { getLangfuseCallback } from "../../../../agents/langfuse";
import { createLlm, AGENT_TIMEOUT_MS, AgentTimeoutError } from "../../../../agents/llm-factory";
import { AGENT_FALLBACK_RESPONSE, TA_HISTORY_TURN_CAP } from "../../../../agents/constants";
import { formatSSEEvent } from "../../../../agents/sse-events";
import { formatSupportMaterials } from "../../../../agents/support-materials";
import { detectLanguageHint } from "../../../../agents/language-detect";

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

      // Load challenge
      const ch = await db
        .select()
        .from(challenge)
        .where(and(eq(challenge.id, ws[0].challengeId), isNull(challenge.deletedAt)))
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

      let modelParams: Record<string, unknown> = {};
      if (ta[0]?.modelId) {
        const m = await db
          .select()
          .from(model)
          .where(eq(model.id, ta[0].modelId))
          .limit(1);
        if (m[0]) {
          modelParams = (m[0].modelParameters as Record<string, unknown>) ?? {};
        }
      }

      const formattedSupportMaterials = formatSupportMaterials(
        ch[0]?.supportMaterials
      );

      // Build system prompt
      const systemPrompt = buildTeachingAssistantPrompt({
        systemPrompt: ta[0]?.systemPrompt ?? "",
        targetAudience: ta[0]?.targetAudience ?? "",
        challengeTitle: ch[0]?.title ?? "",
        challengeDescription: ch[0]?.description ?? "",
        supportMaterials: formattedSupportMaterials,
        currentCode: currentCode ?? "",
        stdout: stdout ?? "",
        detectedLanguage: detectLanguageHint(message),
      });

      // Challenge context for tools
      const challengeContext = {
        title: ch[0]?.title ?? "",
        description: ch[0]?.description ?? "",
        supportMaterials: formattedSupportMaterials,
      };

      // HTTP status is committed here — all subsequent errors must use the SSE error event type
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let fullResponse = "";
      let streamErrored = false;

      const langfuseCallback = getLangfuseCallback({
        userId: user.id,
        sessionId: workSessionId,
        tags: ["agent:ta"],
        metadata: {
          challengeId: ws[0].challengeId,
          workSessionId,
        },
      });

      try {
        // Load recent conversation history for context memory
        const historyRows = await db
          .select()
          .from(userInteractionOnChallenge)
          .where(eq(userInteractionOnChallenge.workSessionId, workSessionId))
          .orderBy(desc(userInteractionOnChallenge.createdAt), desc(userInteractionOnChallenge.id))
          .limit(TA_HISTORY_TURN_CAP);

        // Reverse to chronological order and build message pairs
        const historyMessages = historyRows
          .reverse()
          .flatMap((row) => {
            const msgs: (HumanMessage | AIMessage)[] = [];
            // Only include pairs where modelResponse is non-empty (defensive)
            if (row.userPrompt) {
              msgs.push(new HumanMessage(row.userPrompt));
            }
            if (row.modelResponse?.trim()) {
              msgs.push(new AIMessage(row.modelResponse));
            }
            return msgs;
          });

        // Create LLM instance with model parameters applied
        const llmInstance = createLlm(modelParams);
        const agent = buildTeachingAssistantAgent(llmInstance);


        const callbacks = langfuseCallback ? [langfuseCallback] : [];

        // Use AbortController to enforce timeout
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          AGENT_TIMEOUT_MS,
        );

        try {
          const stream = agent.streamEvents(
            {
              messages: [
                new SystemMessage(systemPrompt),
                ...historyMessages,
                new HumanMessage(message),
              ],
            },
            {
              configurable: {
                thread_id: workSessionId,
                challengeId: ws[0].challengeId,
                challengeContext,
              },
              recursionLimit: 25,
              streamMode: "messages",
              version: "v2",
              signal: controller.signal,
              callbacks,
            },
          );

          for await (const event of stream) {
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
            }
          }

          // If the agent returned nothing (e.g. guardrail triggered), send a fallback
          if (!fullResponse) {
            fullResponse = AGENT_FALLBACK_RESPONSE;
            reply.raw.write(formatSSEEvent({ type: "text", content: fullResponse }));
          }

          reply.raw.write(formatSSEEvent({ type: "done", full_response: fullResponse }));
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
        if (langfuseCallback) {
          await langfuseCallback.flushAsync();
        }
      }

      // Persist interaction to DB (skip if fallback response or stream errored mid-flight)
      if (fullResponse && fullResponse !== AGENT_FALLBACK_RESPONSE && !streamErrored) {
        const interactionId = randomUUID();
        await db.insert(userInteractionOnChallenge).values({
          id: interactionId,
          workSessionId,
          challengeId: ws[0].challengeId,
          interactionType: "chat",
          userPrompt: message,
          modelResponse: fullResponse,
          code: currentCode ?? null,
          stdout: stdout ?? null,
        });
      }

      reply.raw.end();
    },
  );
}
