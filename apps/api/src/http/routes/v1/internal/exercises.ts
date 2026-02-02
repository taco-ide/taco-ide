import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema404 } from "../../_responses/types";

const ExerciseDataSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  initialCode: z.string(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
    })
  ),
});

const ResponseSchema = ResponseSchema200.extend({
  data: ExerciseDataSchema,
});

/**
 * Internal endpoint for AI service to fetch exercise details
 * Protected by internal auth middleware
 */
export async function getExerciseRoute(app: FastifyTypedInstance) {
  app.get(
    "/:id",
    {
      schema: {
        tags: ["internal"],
        description: "Get exercise by ID (Internal - AI Service only)",
        params: z.object({
          id: z.string().transform(Number),
        }),
        response: {
          200: ResponseSchema,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // TODO: Implement actual database query when exercise table is created
      // For now, return mock data
      // const exercise = await db.query.exercise.findFirst({
      //   where: eq(schema.exercise.id, id),
      // });

      // Mock response for development
      const exercise = {
        id,
        title: "Sample Exercise",
        description: "Write a function that adds two numbers",
        initialCode: "def add(a, b):\n    # Your code here\n    pass",
        difficulty: "EASY" as const,
        testCases: [
          { input: "1, 2", expectedOutput: "3" },
          { input: "5, 7", expectedOutput: "12" },
        ],
      };

      if (!exercise) {
        return reply.status(404).send({
          success: false,
          message: "Exercise not found",
        });
      }

      return reply.send({
        success: true,
        data: exercise,
      });
    }
  );
}
