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
import { env } from "@repo/infra/env";

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
        summary: "Send a message to the student tutor agent (SSE)",
        description:
          "Proxies the message to the ADK agent service and streams the response as SSE events. " +
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

      let modelParams = {};
      if (ta[0]?.modelId) {
        const m = await db
          .select()
          .from(model)
          .where(eq(model.id, ta[0].modelId))
          .limit(1);
        if (m[0]) {
          modelParams = m[0].modelParameters ?? {};
        }
      }

      // Build state for the agent
      const agentState = {
        system_prompt: ta[0]?.systemPrompt ?? "",
        target_audience: ta[0]?.targetAudience ?? "",
        challenge_title: ch[0]?.title ?? "",
        challenge_description: ch[0]?.description ?? "",
        support_materials: JSON.stringify(ch[0]?.supportMaterials ?? ""),
        current_code: currentCode ?? "",
        stdout: stdout ?? "",
      };

      // Proxy to agent service
      const agentUrl = `${env.AGENT_SERVICE_URL}/student/run_sse`;
      const agentResponse = await fetch(agentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: workSessionId,
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
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);

          // Parse SSE data lines to accumulate full response
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "done" && data.full_response) {
                  fullResponse = data.full_response;
                }
              } catch {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
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
