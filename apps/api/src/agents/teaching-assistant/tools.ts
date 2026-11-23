import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "@repo/infra/env";
import { searchChallengeKnowledgeBases } from "../../services/knowledge-base-search";
import { EmbeddingUnavailableError } from "../../services/embedding-errors";

const RUN_CODE_TIMEOUT_MS = 30000; // 30 seconds per tool execution

export const runCode = tool(
  async ({ code, stdin }, config) => {
    try {
      // Create a local timeout controller, independently from the agent-level timeout
      const localController = new AbortController();
      const localTimeout = setTimeout(
        () => localController.abort(),
        RUN_CODE_TIMEOUT_MS
      );

      // If the parent signal aborts, also abort the local controller
      const parentSignal = config?.signal;
      if (parentSignal) {
        if (parentSignal.aborted) {
          localController.abort();
        } else {
          parentSignal.addEventListener("abort", () => localController.abort(), { once: true });
        }
      }

      try {
        const response = await fetch(env.CODE_EXEC_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "python",
            version: "3.12.0",
            files: [{ content: code }],
            stdin: stdin ?? "",
          }),
          signal: localController.signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(
            `Code execution API returned ${response.status}: ${body.slice(0, 200)}`
          );
        }

        const data = (await response.json()) as {
          run?: { stdout?: string; stderr?: string; code?: number };
        };
        const run = data.run ?? {};

        return JSON.stringify({
          stdout: run.stdout ?? "",
          stderr: run.stderr ?? "",
          exitCode: run.code ?? -1,
        });
      } finally {
        clearTimeout(localTimeout);
      }
    } catch (err) {
      let errorMessage: string;
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage = "Code execution aborted due to timeout or agent cancellation";
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = "Unknown code execution error";
      }
      return JSON.stringify({
        error: errorMessage,
        stdout: "",
        stderr: "",
        exitCode: -1,
      });
    }
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

const ChallengeContextSchema = z.object({
  title: z.string(),
  description: z.string(),
  supportMaterials: z.string(),
});

export const getChallengeInfo = tool(
  async (_input, config) => {
    const parsed = ChallengeContextSchema.safeParse(
      config.configurable?.challengeContext
    );
    if (!parsed.success) {
      return JSON.stringify({
        error: "Challenge context not available",
        title: "",
        description: "",
        supportMaterials: "",
      });
    }
    return JSON.stringify(parsed.data);
  },
  {
    name: "getChallengeInfo",
    description:
      "Retrieve the current challenge information (title, description, support materials).",
    schema: z.object({}),
  },
);

export const KB_UNAVAILABLE_TOOL_MESSAGE =
  "Course materials are temporarily unavailable (the knowledge base search service could not be reached). Tell the student the materials cannot be consulted right now, and continue helping without them.";

export const KB_NOT_CONFIGURED_TOOL_MESSAGE =
  "Course materials search is not available in this deployment (no embedding service is configured). Do not say it is temporary; if the student asks about course materials, tell them they cannot be searched here, and continue helping without them.";

export const KB_SEARCH_FAILED_TOOL_MESSAGE =
  "The course materials search failed. Tell the student the materials cannot be consulted right now, and continue helping without them.";

function kbFailureToolMessage(err: unknown): string {
  if (!(err instanceof EmbeddingUnavailableError)) {
    return KB_SEARCH_FAILED_TOOL_MESSAGE;
  }
  return err.reason === "not_configured"
    ? KB_NOT_CONFIGURED_TOOL_MESSAGE
    : KB_UNAVAILABLE_TOOL_MESSAGE;
}

/**
 * Tool output contract:
 * - `unavailable: false` — search ran; `results` may be empty (no relevant
 *   material found).
 * - `unavailable: true` — search could not run; `results` is empty and
 *   `error` tells the agent what to say instead of implying none exist:
 *   temporarily unavailable (embedding service down), not available in this
 *   deployment (embeddings not configured), or a generic search failure.
 */
export const searchKnowledgeBase = tool(
  async ({ query }, config) => {
    try {
      const challengeId = config.configurable?.challengeId as string | undefined;
      if (!challengeId) {
        return JSON.stringify({ unavailable: false, results: [] });
      }

      const results = await searchChallengeKnowledgeBases({
        challengeId,
        query,
        limit: 5,
      });

      return JSON.stringify({
        unavailable: false,
        results: results.map((r) => ({
          content: r.content,
          similarity: r.similarity,
          source: r.metadata?.documentFilename ?? "manual entry",
          hierarchy: r.metadata?.titleHierarchy ?? [],
        })),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown knowledge base search error";
      console.warn(
        "Knowledge base search failed:",
        err instanceof EmbeddingUnavailableError
          ? `embedding unavailable (${err.reason}): ${errorMessage}`
          : errorMessage
      );
      return JSON.stringify({
        unavailable: true,
        results: [],
        error: kbFailureToolMessage(err),
      });
    }
  },
  {
    name: "searchKnowledgeBase",
    description:
      "Search the knowledge base for relevant educational content matching the query. If the result has `unavailable: true`, the materials could not be searched right now (not the same as no matches).",
    schema: z.object({
      query: z.string().describe("The search query string"),
    }),
  },
);
