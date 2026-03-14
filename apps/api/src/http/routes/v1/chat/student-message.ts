import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema401,
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
import { eq } from "drizzle-orm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { teachingAssistantAgent } from "../../../../agents/teaching-assistant/agent";
import { buildTeachingAssistantPrompt } from "../../../../agents/teaching-assistant/prompt";

// ==================== SCHEMAS ====================

const StudentMessageBodySchema = z.object({
  workSessionId: z.string(),
  message: z.string().min(1),
  currentCode: z.string().optional(),
  stdout: z.string().optional(),
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
          401: ResponseSchema401,
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
          .status(401)
          .send({ success: false as const, message: "Not authorized" });
      }

      // Load challenge
      const ch = await db
        .select()
        .from(challenge)
        .where(eq(challenge.id, ws[0].challengeId))
        .limit(1);

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

      // Build system prompt
      const systemPrompt = buildTeachingAssistantPrompt({
        systemPrompt: ta[0]?.systemPrompt ?? "",
        targetAudience: ta[0]?.targetAudience ?? "",
        challengeTitle: ch[0]?.title ?? "",
        challengeDescription: ch[0]?.description ?? "",
        supportMaterials: JSON.stringify(ch[0]?.supportMaterials ?? ""),
        currentCode: currentCode ?? "",
        stdout: stdout ?? "",
      });

      // Challenge context for tools
      const challengeContext = {
        title: ch[0]?.title ?? "",
        description: ch[0]?.description ?? "",
        supportMaterials: JSON.stringify(ch[0]?.supportMaterials ?? ""),
      };

      // Stream SSE to the client
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let fullResponse = "";

      try {
        const stream = teachingAssistantAgent.streamEvents(
          {
            messages: [
              new SystemMessage(systemPrompt),
              new HumanMessage(message),
            ],
          },
          {
            configurable: {
              thread_id: workSessionId,
              challengeContext,
              ...modelParams,
            },
            streamMode: "messages",
            version: "v2",
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
              const data = JSON.stringify({ type: "text", content });
              reply.raw.write(`data: ${data}\n\n`);
            }
          }
        }

        // Send done event
        const doneData = JSON.stringify({
          type: "done",
          full_response: fullResponse,
        });
        reply.raw.write(`data: ${doneData}\n\n`);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Agent invocation failed";
        const errorData = JSON.stringify({ type: "error", content: errorMsg });
        reply.raw.write(`data: ${errorData}\n\n`);
      }

      // Persist interaction to DB
      if (fullResponse) {
        const interactionId = crypto.randomUUID();
        await db.insert(userInteractionOnChallenge).values({
          id: interactionId,
          workSessionId,
          challengeId: ws[0].challengeId,
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
