import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  workSession,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const AddInteractionParamsSchema = z.object({
  id: z.string().uuid(),
});

const AddInteractionBodySchema = z.object({
  interactionType: z.enum(["chat", "code_run"]),
  userPrompt: z.string().default(""),
  modelResponse: z.string().default(""),
  code: z.string().optional(),
  stdin: z.string().optional(),
  stdout: z.string().optional(),
});

const InteractionSchema = z.object({
  id: z.string(),
  interactionType: z.string(),
  userPrompt: z.string(),
  modelResponse: z.string(),
  code: z.string().nullable(),
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  createdAt: z.string(),
});

const AddInteractionResponseSchema = ResponseSchema201.extend({
  data: InteractionSchema,
});

// ==================== ROUTE ====================

export async function addInteractionRoute(app: FastifyTypedInstance) {
  app.post<{
    Params: z.infer<typeof AddInteractionParamsSchema>;
    Body: z.infer<typeof AddInteractionBodySchema>;
  }>(
    "/:id/interactions",
    {
      schema: {
        tags: ["work-sessions"],
        summary: "Add interaction to work session",
        description:
          "Record a chat message or code run in the work session history",
        params: AddInteractionParamsSchema,
        body: AddInteractionBodySchema,
        response: {
          201: AddInteractionResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
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
        interactionType,
        userPrompt,
        modelResponse,
        code,
        stdin,
        stdout,
      } = request.body;

      const [session] = await db
        .select()
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
          message: "Not authorized to add interactions to this work session",
        });
      }

      if (session.endedAt) {
        return reply.status(400).send({
          success: false as const,
          message: "Cannot add interactions to an ended work session",
        });
      }

      const now = new Date();
      const interactionId = randomUUID();

      await db.insert(userInteractionOnChallenge).values({
        id: interactionId,
        workSessionId,
        challengeId: session.challengeId,
        interactionType,
        userPrompt,
        modelResponse,
        code,
        stdin,
        stdout,
      });

      await db
        .update(workSession)
        .set({
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(eq(workSession.id, workSessionId));

      return reply.status(201).send({
        success: true as const,
        data: {
          id: interactionId,
          interactionType,
          userPrompt,
          modelResponse,
          code: code ?? null,
          stdin: stdin ?? null,
          stdout: stdout ?? null,
          createdAt: now.toISOString(),
        },
      });
    }
  );
}
