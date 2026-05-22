import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { db } from "@repo/infra/db";
import {
  challengeSolution,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import { user } from "@repo/infra/db/schema";
import { eq, asc } from "drizzle-orm";
import { createLlm } from "../llm-factory";

export const createChallengeDraft = tool(
  async ({ title, description, difficulty, testCases, solution }) => {
    return JSON.stringify({
      status: "draft_created",
      draft: { title, description, difficulty, testCases, solution },
    });
  },
  {
    name: "createChallengeDraft",
    description:
      "Create a draft challenge that can be reviewed by the teacher. " +
      "The draft is returned for the teacher to review before persisting.",
    schema: z.object({
      title: z.string().describe("The challenge title"),
      description: z
        .string()
        .describe("The challenge description with problem statement"),
      difficulty: z
        .enum(["easy", "medium", "hard"])
        .describe("The difficulty level"),
      testCases: z
        .array(
          z.object({
            input: z.string(),
            expectedOutput: z.string(),
          }),
        )
        .describe("A list of test cases with input and expected output"),
      solution: z.string().describe("A reference solution in Python"),
    }),
  },
);

export const listSubmissions = tool(
  async ({ challengeId, limit, offset }) => {
    const effectiveLimit = limit ?? 50;
    const effectiveOffset = offset ?? 0;
    const rows = await db
      .select({
        id: challengeSolution.id,
        userId: challengeSolution.userId,
        studentName: user.name,
        code: challengeSolution.code,
        stdout: challengeSolution.stdout,
        updatedAt: challengeSolution.updatedAt,
      })
      .from(challengeSolution)
      .innerJoin(user, eq(user.id, challengeSolution.userId))
      .where(eq(challengeSolution.challengeId, challengeId))
      .limit(effectiveLimit)
      .offset(effectiveOffset);

    return JSON.stringify({
      submissions: rows.map((r) => ({
        id: r.id,
        studentName: r.studentName,
        code: r.code,
        stdout: r.stdout,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
      limit: effectiveLimit,
      offset: effectiveOffset,
      hasMore: rows.length === effectiveLimit,
    });
  },
  {
    name: "listSubmissions",
    description:
      "List student submissions for a given challenge, including student name and code. " +
      "Supports pagination via limit (default 50, max 100) and offset (default 0).",
    schema: z.object({
      challengeId: z
        .string()
        .describe("The ID of the challenge to list submissions for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of submissions to return (default 50, max 100)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Offset for pagination (default 0)"),
    }),
  },
);

export const evaluateSubmission = tool(
  async ({ submissionId, interactionLimit, interactionOffset }) => {
    const effectiveLimit = interactionLimit ?? 100;
    const effectiveOffset = interactionOffset ?? 0;
    const solutions = await db
      .select({
        id: challengeSolution.id,
        userId: challengeSolution.userId,
        studentName: user.name,
        code: challengeSolution.code,
        stdout: challengeSolution.stdout,
        challengeId: challengeSolution.challengeId,
      })
      .from(challengeSolution)
      .innerJoin(user, eq(user.id, challengeSolution.userId))
      .where(eq(challengeSolution.id, submissionId))
      .limit(1);

    if (!solutions[0]) {
      return JSON.stringify({ error: "Submission not found" });
    }

    const solution = solutions[0];

    const interactions = await db
      .select({
        userPrompt: userInteractionOnChallenge.userPrompt,
        modelResponse: userInteractionOnChallenge.modelResponse,
        code: userInteractionOnChallenge.code,
        stdout: userInteractionOnChallenge.stdout,
        createdAt: userInteractionOnChallenge.createdAt,
      })
      .from(userInteractionOnChallenge)
      .where(
        eq(userInteractionOnChallenge.challengeId, solution.challengeId),
      )
      .orderBy(asc(userInteractionOnChallenge.createdAt))
      .limit(effectiveLimit)
      .offset(effectiveOffset);

    return JSON.stringify({
      submission: {
        id: solution.id,
        studentName: solution.studentName,
        code: solution.code,
        stdout: solution.stdout,
      },
      interactions: interactions.map((i) => ({
        userPrompt: i.userPrompt,
        modelResponse: i.modelResponse,
        code: i.code,
        stdout: i.stdout,
        createdAt: i.createdAt?.toISOString() ?? null,
      })),
      interactionLimit: effectiveLimit,
      interactionOffset: effectiveOffset,
      hasMoreInteractions: interactions.length === effectiveLimit,
    });
  },
  {
    name: "evaluateSubmission",
    description:
      "Load a student submission and its interaction history for evaluation. " +
      "Returns the code, output, and full chat history. " +
      "Interaction history supports pagination via interactionLimit (default 100, max 200) and interactionOffset (default 0).",
    schema: z.object({
      submissionId: z
        .string()
        .describe("The ID of the challenge_solution to evaluate"),
      interactionLimit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of interactions to return (default 100, max 200)"),
      interactionOffset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Offset for paginating the interaction history (default 0)"),
    }),
  },
);

const SuggestedTestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  label: z.string(),
  rationale: z.string().optional(),
});

const SuggestTestCasesPayloadSchema = z.object({
  testCases: z.array(SuggestedTestCaseSchema),
});

export const suggestTestCases = tool(
  async ({ problemDescription, solution }) => {
    try {
      // Nested LLM call: sub-chain that returns structured test cases.
      // Uses a fresh ChatOpenAI instance so it does not pollute the agent's thread.
      const llm = createLlm({ temperature: 0.2 });
      const prompt = `You are generating Python test cases for an educational challenge.

Problem description:
${problemDescription}

Reference solution (Python):
\`\`\`python
${solution}
\`\`\`

Generate 6 to 10 comprehensive test cases covering: edge cases, boundary values, typical inputs, and error cases.
Return ONLY a JSON object (no markdown, no commentary) of the shape:
{
  "testCases": [
    { "input": "<stdin string>", "expectedOutput": "<stdout string>", "label": "<short label>", "rationale": "<one-line reasoning>" }
  ]
}`;

      const response = await llm.invoke([new HumanMessage(prompt)]);
      const raw =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      // Strip fenced code blocks defensively
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      const parsed = SuggestTestCasesPayloadSchema.safeParse(
        JSON.parse(cleaned)
      );

      if (!parsed.success) {
        return JSON.stringify({
          testCases: [],
          error: "LLM output did not match expected schema",
        });
      }

      return JSON.stringify(parsed.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error generating test cases";
      return JSON.stringify({
        testCases: [],
        error: `Failed to generate test cases: ${errorMessage}`,
      });
    }
  },
  {
    name: "suggestTestCases",
    description:
      "Generate a comprehensive list of structured test cases for a programming challenge, " +
      "given the problem description and reference solution. Each test case includes input, " +
      "expected output, a short label, and a rationale.",
    schema: z.object({
      problemDescription: z
        .string()
        .describe("The challenge problem description"),
      solution: z.string().describe("The reference solution code"),
    }),
  },
);

const ClassroomContextSchema = z.object({
  classroomId: z.string(),
  classroomName: z.string(),
  classroomDescription: z.string(),
});

export const getClassroomInfo = tool(
  async (_input, config) => {
    const parsed = ClassroomContextSchema.safeParse(
      config.configurable?.classroomContext
    );
    if (!parsed.success) {
      return JSON.stringify({
        error: "Classroom context not available",
        classroomId: "",
        classroomName: "",
        classroomDescription: "",
      });
    }
    return JSON.stringify(parsed.data);
  },
  {
    name: "getClassroomInfo",
    description: "Retrieve the current classroom information from context.",
    schema: z.object({}),
  },
);
