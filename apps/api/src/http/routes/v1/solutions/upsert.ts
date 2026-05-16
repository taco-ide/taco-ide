import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema201,
  ResponseSchema401,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { challengeSolution, challenge } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const UpsertSolutionBodySchema = z
  .object({
    code: z.string().optional(),
    stdin: z.string().optional(),
    stdout: z.string().optional(),
    chatHistory: z.unknown().optional(),
  })
  .strict();

const SolutionSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  stdin: z.string().nullable(),
  stdout: z.string().nullable(),
  chatHistory: z.unknown().nullable(),
  updatedAt: z.string(),
});

// const UpsertSolutionResponseSchema = z.discriminatedUnion("success", [
//   ResponseSchema200.extend({ data: SolutionSchema }),
//   ResponseSchema201.extend({ data: SolutionSchema }),
// ]);

// ==================== ROUTE ====================

export async function upsertSolutionRoute(app: FastifyTypedInstance) {
  app.put<{
    Params: { id: string };
    Body: z.infer<typeof UpsertSolutionBodySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["solutions"],
        summary: "Create or update solution",
        description:
          "Creates or updates the user's solution state for a challenge",
        params: z.object({ id: z.string().min(1) }),
        body: UpsertSolutionBodySchema,
        response: {
          200: ResponseSchema200.extend({ data: SolutionSchema }),
          201: ResponseSchema201.extend({ data: SolutionSchema }),
          401: ResponseSchema401,
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

      const challengeId = request.params.id;
      const { code, stdin, stdout, chatHistory } = request.body;

      const ch = await db
        .select({ id: challenge.id })
        .from(challenge)
        .where(and(eq(challenge.id, challengeId), isNull(challenge.deletedAt)))
        .limit(1);

      if (!ch[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const now = new Date();
      const newId = randomUUID();

      const updateSet: Record<string, unknown> = { updatedAt: now };
      if (code !== undefined) updateSet.code = code;
      if (stdin !== undefined) updateSet.stdin = stdin;
      if (stdout !== undefined) updateSet.stdout = stdout;
      if (chatHistory !== undefined) updateSet.chatHistory = chatHistory;

      const [result] = await db
        .insert(challengeSolution)
        .values({
          id: newId,
          userId: usr.id,
          challengeId,
          code: code ?? null,
          stdin: stdin ?? null,
          stdout: stdout ?? null,
          chatHistory: chatHistory ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [challengeSolution.userId, challengeSolution.challengeId],
          set: updateSet as typeof challengeSolution.$inferInsert,
        })
        .returning();

      if (!result) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to upsert solution",
        });
      }

      const isCreated = result.id === newId;
      const status = isCreated ? 201 : 200;

      const data = {
        id: result.id,
        code: result.code,
        stdin: result.stdin,
        stdout: result.stdout,
        chatHistory: result.chatHistory,
        updatedAt: result.updatedAt.toISOString(),
      };

      return reply.status(status).send({
        success: true as const,
        data,
      });
    }
  );
}
