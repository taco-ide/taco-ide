import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema401,
  ResponseSchema404,
  ResponseSchema500,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { classroom, member } from "@repo/infra/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@repo/infra/env";

// ==================== SCHEMAS ====================

const TeacherMessageBodySchema = z.object({
  classroomId: z.string(),
  message: z.string().min(1),
});

// ==================== ROUTE ====================

export async function teacherMessageRoute(app: FastifyTypedInstance) {
  app.post(
    "/teacher/message",
    {
      schema: {
        tags: ["chat"],
        summary: "Send a message to the teacher assistant agent (SSE)",
        description:
          "Proxies the message to the ADK teacher agent and streams the response as SSE events. " +
          "Teacher chat is ephemeral for MVP (no DB persistence).",
        body: TeacherMessageBodySchema,
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
        return reply.status(401).send({
          success: false as const,
          message: "Not a member of this organization",
        });
      }

      // Build state for the agent
      const agentState = {
        classroom_id: cr[0].id,
        classroom_name: cr[0].title,
        classroom_description: cr[0].description ?? "",
      };

      // Proxy to agent service
      const agentUrl = `${env.AGENT_SERVICE_URL}/teacher/run_sse`;
      const agentResponse = await fetch(agentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: `teacher-${classroomId}-${user.id}`,
          user_id: user.id,
          message,
          state: agentState,
        }),
      });

      if (!agentResponse.ok || !agentResponse.body) {
        return reply.status(500).send({
          success: false as const,
          message: "Agent service unavailable",
        });
      }

      // Stream SSE to the client
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const reader = agentResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }

      reply.raw.end();
    },
  );
}
