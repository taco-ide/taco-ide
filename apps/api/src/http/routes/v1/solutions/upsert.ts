import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
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

const UpsertSolutionBodySchema = z.object({
  code: z.string().optional(),
  stdin: z.string().optional(),
  stdout: z.string().optional(),
  chatHistory: z.unknown().optional(),
});

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
        params: z.object({ id: z.string().uuid() }),
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

      const [existing] = await db
        .select()
        .from(challengeSolution)
        .where(
          and(
            eq(challengeSolution.userId, usr.id),
            eq(challengeSolution.challengeId, challengeId)
          )
        )
        .limit(1);

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (code !== undefined) updateData.code = code;
      if (stdin !== undefined) updateData.stdin = stdin;
      if (stdout !== undefined) updateData.stdout = stdout;
      if (chatHistory !== undefined) updateData.chatHistory = chatHistory;

      if (existing) {
        const [updated] = await db
          .update(challengeSolution)
          .set(updateData as typeof challengeSolution.$inferInsert)
          .where(eq(challengeSolution.id, existing.id))
          .returning();

        if (!updated) {
          return reply.status(500).send({
            success: false as const,
            message: "Failed to update solution",
          });
        }

        return reply.status(200).send({
          success: true as const,
          data: {
            id: updated.id,
            code: updated.code,
            stdin: updated.stdin,
            stdout: updated.stdout,
            chatHistory: updated.chatHistory,
            updatedAt: updated.updatedAt.toISOString(),
          },
        });
      }

      const [created] = await db
        .insert(challengeSolution)
        .values({
          id: randomUUID(),
          userId: usr.id,
          challengeId,
          code: code ?? null,
          stdin: stdin ?? null,
          stdout: stdout ?? null,
          chatHistory: chatHistory ?? null,
        })
        .returning();

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create solution",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          code: created.code,
          stdin: created.stdin,
          stdout: created.stdout,
          chatHistory: created.chatHistory,
          updatedAt: created.updatedAt.toISOString(),
        },
      });
    }
  );
}
