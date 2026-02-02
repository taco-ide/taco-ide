import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200 } from "../../_responses/types";

const SubmissionSchema = z.object({
  id: z.number(),
  userId: z.number(),
  code: z.string(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
  createdAt: z.date(),
});

const ResponseSchema = ResponseSchema200.extend({
  data: z.array(SubmissionSchema),
});

/**
 * Internal endpoint for AI service to fetch recent submissions for an exercise
 * Used to understand common mistakes and patterns
 * Protected by internal auth middleware
 */
export async function getRecentSubmissionsRoute(app: FastifyTypedInstance) {
  app.get(
    "/:exerciseId/recent",
    {
      schema: {
        tags: ["internal"],
        description:
          "Get recent submissions for exercise (Internal - AI Service only)",
        params: z.object({
          exerciseId: z.string().transform(Number),
        }),
        querystring: z.object({
          limit: z.string().transform(Number).default("10"),
        }),
        response: {
          200: ResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { exerciseId } = request.params;
      const { limit } = request.query;

      // TODO: Implement actual database query when submission tables are created
      // For now, return empty array
      // const submissions = await db.query.submission.findMany({
      //   where: eq(schema.submission.exerciseId, exerciseId),
      //   orderBy: desc(schema.submission.createdAt),
      //   limit,
      // });

      // Mock response for development
      const submissions: z.infer<typeof SubmissionSchema>[] = [];

      return reply.send({
        success: true,
        data: submissions,
      });
    }
  );
}
