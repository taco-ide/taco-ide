import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "@repo/infra/env";
import { db } from "@repo/infra/db";
import { knowledgeBase } from "@repo/infra/db/schema";
import { ilike } from "drizzle-orm";

export const runCode = tool(
  async ({ code, stdin }) => {
    const response = await fetch(env.CODE_EXEC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        version: "3.12.0",
        files: [{ content: code }],
        stdin: stdin ?? "",
      }),
    });

    const data = (await response.json()) as {
      run?: { stdout?: string; stderr?: string; code?: number };
    };
    const run = data.run ?? {};

    return JSON.stringify({
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      exitCode: run.code ?? -1,
    });
  },
  {
    name: "runCode",
    description:
      "Execute Python code in a sandboxed environment. Returns stdout, stderr, and exit code.",
    schema: z.object({
      code: z.string().describe("The Python code to execute"),
      stdin: z
        .string()
        .optional()
        .describe("Standard input to provide to the program"),
    }),
  },
);

export const getChallengeInfo = tool(
  async (_input, config) => {
    const ctx = config.configurable?.challengeContext ?? {};
    return JSON.stringify({
      title: ctx.title ?? "",
      description: ctx.description ?? "",
      supportMaterials: ctx.supportMaterials ?? "",
    });
  },
  {
    name: "getChallengeInfo",
    description:
      "Retrieve the current challenge information (title, description, support materials).",
    schema: z.object({}),
  },
);

export const searchKnowledgeBase = tool(
  async ({ query }) => {
    const rows = await db
      .select({ id: knowledgeBase.id, content: knowledgeBase.content })
      .from(knowledgeBase)
      .where(ilike(knowledgeBase.content, `%${query}%`))
      .limit(5);

    return JSON.stringify({
      results: rows.map((r) => ({ id: r.id, content: r.content })),
    });
  },
  {
    name: "searchKnowledgeBase",
    description:
      "Search the knowledge base for relevant educational content matching the query.",
    schema: z.object({
      query: z.string().describe("The search query string"),
    }),
  },
);
