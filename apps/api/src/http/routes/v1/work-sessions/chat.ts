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
  ResponseSchema503,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  teachingAssistant,
  challenge,
  userInteractionOnChallenge,
  challengeSolution,
  model,
} from "@repo/infra/db/schema";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { teachingAssistantAgent } from "../../../../agents/teaching-assistant/agent";
import { buildTeachingAssistantPrompt } from "../../../../agents/teaching-assistant/prompt";
import { searchChallengeKnowledgeBases } from "../../../../services/knowledge-base-search";

// ==================== SCHEMAS ====================

const ChatParamsSchema = z.object({
  id: z.string().min(1),
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
          "Sends a user message to the Teaching Assistant agent, saves the interaction, and returns the AI response",
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

      let modelParams: Record<string, unknown> = {};
      if (ta.modelId) {
        const [m] = await db
          .select()
          .from(model)
          .where(eq(model.id, ta.modelId))
          .limit(1);
        if (m) {
          modelParams = (m.modelParameters as Record<string, unknown>) ?? {};
        }
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

      const code = bodyCode ?? solution?.code ?? null;
      const stdout = bodyStdout ?? solution?.stdout ?? null;

      // RAG: Search challenge knowledge bases for relevant context
      let kbContext = "";
      try {
        const kbResults = await searchChallengeKnowledgeBases({
          challengeId: session.challengeId,
          query: message,
          limit: 5,
        });

        if (kbResults.length > 0) {
          const formattedChunks = kbResults.map((result) => {
            const hierarchy = result.metadata?.titleHierarchy ?? [];
            const source = result.metadata?.documentFilename ?? "manual entry";
            const header =
              hierarchy.length > 0
                ? `[${hierarchy.join(" > ")}] (fonte: ${source})`
                : `(fonte: ${source})`;
            return `${header}\n${result.content}`;
          });
          kbContext = formattedChunks.join("\n\n---\n\n");
        }
      } catch (err) {
        request.server.log.warn(
          { err },
          "KB search failed during chat, proceeding without RAG"
        );
      }

      const systemPrompt = buildTeachingAssistantPrompt({
        systemPrompt: ta.systemPrompt,
        targetAudience: ta.targetAudience ?? "",
        challengeTitle: ch?.title ?? "",
        challengeDescription: ch?.description ?? "",
        supportMaterials: JSON.stringify(ch?.supportMaterials ?? ""),
        kbContext: kbContext || undefined,
        currentCode: code ?? "",
        stdout: stdout ?? "",
      });

      const challengeContext = {
        title: ch?.title ?? "",
        description: ch?.description ?? "",
        supportMaterials: JSON.stringify(ch?.supportMaterials ?? ""),
      };

      let modelResponse: string;
      try {
        const result = await teachingAssistantAgent.invoke(
          {
            messages: [
              new SystemMessage(systemPrompt),
              new HumanMessage(message),
            ],
          },
          {
            configurable: {
              thread_id: workSessionId,
              challengeId: session.challengeId,
              challengeContext,
              ...modelParams,
            },
          },
        );

        // The agent returns a messages array; the last message is the AI reply.
        const lastMsg = result.messages[result.messages.length - 1];
        const rawResponse =
          typeof lastMsg?.content === "string"
            ? lastMsg.content
            : JSON.stringify(lastMsg?.content ?? "");
        // If the agent returned nothing (e.g. guardrail triggered), use a fallback
        modelResponse =
          rawResponse.trim() ||
          "Não posso ajudar com isso. Vamos focar no exercício de programação? Se tiver dúvidas sobre o código ou o problema, estou aqui para ajudar!";
      } catch (err) {
        console.error("LangGraph agent error:", err);
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
