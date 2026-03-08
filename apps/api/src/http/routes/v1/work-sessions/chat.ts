import { z } from "zod";
import { eq, and, asc, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  teachingAssistant,
  challenge,
  userInteractionOnChallenge,
  challengeSolution,
} from "@repo/infra/db/schema";
import { env } from "@repo/infra/env";
import { createChatCompletion } from "../../../../lib/openrouter";

// ==================== SCHEMAS ====================

const ChatParamsSchema = z.object({
  id: z.string().uuid(),
});

const ChatBodySchema = z.object({
  message: z.string().min(1).max(10000),
  code: z.string().optional(),
  stdin: z.string().optional(),
  stdout: z.string().optional(),
});

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
      schema: {
        tags: ["work-sessions"],
        summary: "Send chat message and get TA response",
        description:
          "Sends a user message to the Teaching Assistant via OpenRouter, saves the interaction, and returns the AI response",
        params: ChatParamsSchema,
        body: ChatBodySchema,
        response: {
          200: ChatResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
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

      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({
          success: false as const,
          message:
            "OpenRouter API key not configured. Set OPENROUTER_API_KEY in environment.",
        });
      }

      const { id: workSessionId } = request.params;
      const { message, code: bodyCode, stdin: bodyStdin, stdout: bodyStdout } =
        request.body;

      const [session] = await db
        .select({
          id: workSession.id,
          userId: workSession.userId,
          challengeId: workSession.challengeId,
          teachingAssistantId: workSession.teachingAssistantId,
          endedAt: workSession.endedAt,
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

      if (session.endedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "Cannot chat in an ended work session",
        });
      }

      const [ta] = await db
        .select({
          id: teachingAssistant.id,
          systemPrompt: teachingAssistant.systemPrompt,
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
        })
        .from(challenge)
        .where(and(eq(challenge.id, session.challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      const [solution] = await db
        .select({
          code: challengeSolution.code,
          stdin: challengeSolution.stdin,
          stdout: challengeSolution.stdout,
        })
        .from(challengeSolution)
        .where(
          and(
            eq(challengeSolution.userId, usr.id),
            eq(challengeSolution.challengeId, session.challengeId)
          )
        )
        .limit(1);

      const challengeContext = ch
        ? `Problema atual: ${ch.title}\n${ch.description || ""}`
        : "";

      const code = bodyCode ?? solution?.code ?? null;
      const stdin = bodyStdin ?? solution?.stdin ?? null;
      const stdout = bodyStdout ?? solution?.stdout ?? null;

      let codeContext = "";
      if (code || stdin || stdout) {
        const parts: string[] = [];
        if (code) {
          parts.push(`Código atual do aluno:\n\`\`\`\n${code}\n\`\`\``);
        }
        if (stdin) {
          parts.push(`Input (stdin) usado na última execução:\n\`\`\`\n${stdin}\n\`\`\``);
        }
        if (stdout) {
          parts.push(`Output/erro (stdout) da última execução:\n\`\`\`\n${stdout}\n\`\`\``);
        }
        codeContext = `\n\nContexto do trabalho do aluno:\n${parts.join("\n\n")}`;
      }

      const systemContent = [
        ta.systemPrompt,
        challengeContext ? `\n\nContexto do problema:\n${challengeContext}` : "",
        codeContext,
      ].join("");

      const chatInteractions = await db
        .select({
          userPrompt: userInteractionOnChallenge.userPrompt,
          modelResponse: userInteractionOnChallenge.modelResponse,
        })
        .from(userInteractionOnChallenge)
        .where(
          and(
            eq(userInteractionOnChallenge.workSessionId, workSessionId),
            eq(userInteractionOnChallenge.interactionType, "chat")
          )
        )
        .orderBy(asc(userInteractionOnChallenge.createdAt));

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemContent },
      ];

      for (const i of chatInteractions) {
        if (i.userPrompt) {
          messages.push({ role: "user", content: i.userPrompt });
        }
        if (i.modelResponse) {
          messages.push({ role: "assistant", content: i.modelResponse });
        }
      }

      messages.push({ role: "user", content: message });

      let modelResponse: string;
      try {
        const result = await createChatCompletion({
          apiKey,
          messages,
          maxTokens: 2048,
          temperature: 0.7,
        });
        modelResponse = result.content;
      } catch (err) {
        console.error("OpenRouter error:", err);
        return reply.status(503).send({
          success: false as const,
          message:
            err instanceof Error ? err.message : "Failed to get AI response",
        });
      }

      const now = new Date();
      const interactionId = randomUUID();

      await db.insert(userInteractionOnChallenge).values({
        id: interactionId,
        workSessionId,
        challengeId: session.challengeId,
        interactionType: "chat",
        userPrompt: message,
        modelResponse,
      });

      await db
        .update(workSession)
        .set({
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(eq(workSession.id, workSessionId));

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
