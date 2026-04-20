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
import { createLlm, AGENT_TIMEOUT_MS } from "../../../../agents/llm-factory";

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
                const data = JSON.stringify({ type: "text", content });
                reply.raw.write(`data: ${data}\n\n`);
              }
            }
          }

          // Send done event
          const doneData = JSON.stringify({ type: "done" });
          reply.raw.write(`data: ${doneData}\n\n`);
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error && err.name === "AbortError"
            ? "AI response timed out, please try again"
            : err instanceof Error
              ? err.message
              : "Agent invocation failed";
        const errorData = JSON.stringify({ type: "error", content: errorMsg });
        reply.raw.write(`data: ${errorData}\n\n`);
      } finally {
        if (langfuseCallback) {
          await langfuseCallback.flushAsync();
        }
      }

      reply.raw.end();
    },
  );
}
