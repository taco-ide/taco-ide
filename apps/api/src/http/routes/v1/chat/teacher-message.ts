import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema500,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { classroom, member } from "@repo/infra/db/schema";
import { eq, and } from "drizzle-orm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { buildTeachersCompanionAgent } from "../../../../agents/teachers-companion/agent";
import { buildTeachersCompanionPrompt } from "../../../../agents/teachers-companion/prompt";
import { getLangfuseCallback } from "../../../../agents/langfuse";
import { createLlm, AGENT_TIMEOUT_MS, AgentTimeoutError } from "../../../../agents/llm-factory";
import { formatSSEEvent } from "../../../../agents/sse-events";
import { AGENT_FALLBACK_RESPONSE } from "../../../../agents/constants";

// ==================== SCHEMAS ====================

const TeacherMessageBodySchema = z
  .object({
    classroomId: z.string(),
    message: z.string().min(1),
  })
  .strict();

// ==================== ROUTE ====================

export async function teacherMessageRoute(app: FastifyTypedInstance) {
  app.post(
    "/teacher/message",
    {
      schema: {
        tags: ["chat"],
        summary: "Send a message to the teacher's companion agent (SSE)",
        description:
          "Invokes the LangGraph teacher's companion agent in-process and streams the response as SSE events. " +
          "Teacher chat is ephemeral for MVP (no DB persistence).",
        body: TeacherMessageBodySchema,
        response: {
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

      const { classroomId, message } = request.body;

      // Load classroom
      const cr = await db
        .select()
        .from(classroom)
        .where(eq(classroom.id, classroomId))
        .limit(1);

      if (!cr[0]) {
        return reply
          .status(404)
          .send({ success: false as const, message: "Classroom not found" });
      }

      // Verify user is a member of the classroom's organization
      const membership = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, user.id),
            eq(member.organizationId, cr[0].organizationId),
          ),
        )
        .limit(1);

      if (!membership[0]) {
        return reply.status(403).send({
          success: false as const,
          message: "Not a member of this organization",
        });
      }

      if (!["teacher", "coordinator", "owner"].includes(membership[0].role)) {
        return reply.status(403).send({
          success: false as const,
          message: "Only teachers can access this resource",
        });
      }

      // Build system prompt
      const systemPrompt = buildTeachersCompanionPrompt({
        classroomName: cr[0].title,
        classroomDescription: cr[0].description ?? "",
      });

      // Classroom context for tools
      const classroomContext = {
        classroomId: cr[0].id,
        classroomName: cr[0].title,
        classroomDescription: cr[0].description ?? "",
      };

      // Stream SSE to the client
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let fullResponse = "";

      const langfuseCallback = getLangfuseCallback({
        userId: user.id,
        sessionId: `teacher-${classroomId}-${user.id}`,
        tags: ["agent:tc"],
        metadata: { classroomId },
      });

      try {
        // Create LLM instance with default parameters
        const llmInstance = createLlm();
        const agent = buildTeachersCompanionAgent(llmInstance);


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
                new HumanMessage(message),
              ],
            },
            {
              configurable: {
                thread_id: `teacher-${classroomId}-${user.id}`,
                classroomContext,
              },
              streamMode: "messages",
              version: "v2",
              signal: controller.signal,
              recursionLimit: 25,
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

          // Send done event with accumulated full response
          reply.raw.write(formatSSEEvent({ type: "done", full_response: fullResponse }));
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
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

      reply.raw.end();
    },
  );
}
