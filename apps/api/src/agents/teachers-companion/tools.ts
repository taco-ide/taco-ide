import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@repo/infra/db";
import {
  challengeSolution,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
import { user } from "@repo/infra/db/schema";
import { eq, asc } from "drizzle-orm";

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
  async ({ challengeId }) => {
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
      .limit(50);

    return JSON.stringify({
      submissions: rows.map((r) => ({
        id: r.id,
        studentName: r.studentName,
        code: r.code,
        stdout: r.stdout,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
    });
  },
  {
    name: "listSubmissions",
    description:
      "List student submissions for a given challenge, including student name and code.",
    schema: z.object({
      challengeId: z
        .string()
        .describe("The ID of the challenge to list submissions for"),
    }),
  },
);

export const evaluateSubmission = tool(
  async ({ submissionId }) => {
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
      .limit(100);

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
    });
  },
  {
    name: "evaluateSubmission",
    description:
      "Load a student submission and its interaction history for evaluation. " +
      "Returns the code, output, and full chat history.",
    schema: z.object({
      submissionId: z
        .string()
        .describe("The ID of the challenge_solution to evaluate"),
    }),
  },
);

export const suggestTestCases = tool(
  async ({ problemDescription, solution }) => {
    return JSON.stringify({
      instruction:
        "Based on the problem description and reference solution below, " +
        "suggest comprehensive test cases covering: edge cases, boundary " +
        "values, typical inputs, and error cases.",
      problemDescription,
      solution,
    });
  },
  {
    name: "suggestTestCases",
    description:
      "Provide problem context for the LLM to reason about and suggest test cases.",
    schema: z.object({
      problemDescription: z
        .string()
        .describe("The challenge problem description"),
      solution: z.string().describe("The reference solution code"),
    }),
  },
);

export const getClassroomInfo = tool(
  async (_input, config) => {
    const ctx = config.configurable?.classroomContext ?? {};
    return JSON.stringify({
      classroomId: ctx.classroomId ?? "",
      classroomName: ctx.classroomName ?? "",
      classroomDescription: ctx.classroomDescription ?? "",
    });
  },
  {
    name: "getClassroomInfo",
    description: "Retrieve the current classroom information from context.",
    schema: z.object({}),
  },
);
