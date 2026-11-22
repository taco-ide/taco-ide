import { and, desc, eq } from "drizzle-orm";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  challengeSolution,
  model,
  userInteractionOnChallenge,
  type TaRetrieval,
} from "@repo/infra/db/schema";
import { buildTeachingAssistantAgent } from "./agent";
import {
  buildTeachingAssistantPrompt,
  type TeachingAssistantPromptContext,
} from "./prompt";
import { createTurnCollector, toRetrieval, type TurnCollector } from "./turn-context";
import { createLlm } from "../llm-factory";
import {
  TA_HISTORY_TURN_CAP,
  TA_KB_SEARCH_LIMIT,
  TA_KB_SIMILARITY_THRESHOLD,
} from "../constants";
import { formatSupportMaterials } from "../support-materials";
import { detectLanguageHint } from "../language-detect";
import {
  searchChallengeKnowledgeBases,
  type KBSearchResult,
} from "../../services/knowledge-base-search";

export interface PrepareTurnInput {
  workSessionId: string;
  userId: string;
  challengeId: string;
  ta: {
    systemPrompt: string;
    targetAudience: string | null;
    modelId: string | null;
  };
  /** Undefined when the challenge row is gone; the prompt then gets empty strings. */
  challenge:
    | {
        title: string | null;
        description: string | null;
        supportMaterials: unknown;
      }
    | undefined;
  message: string;
  /** What the client sent; missing fields fall back to the saved solution. */
  body: { code?: string; stdin?: string; stdout?: string };
  onPrefetchError?: (err: unknown) => void;
}

export interface PreparedTurn {
  systemPrompt: string;
  promptContext: TeachingAssistantPromptContext;
  inputMessages: BaseMessage[];
  historyInteractionIds: string[];
  prefetch: TaRetrieval;
  collector: TurnCollector;
  llm: ReturnType<typeof createLlm>;
  agent: ReturnType<typeof buildTeachingAssistantAgent>;
  configurable: Record<string, unknown>;
  /** The code, stdin and stdout this turn ran with, for the interaction row. */
  workspace: { code: string | null; stdin: string | null; stdout: string | null };
}

function formatKbContext(results: KBSearchResult[]): string {
  return results
    .map((result) => {
      const hierarchy = result.metadata?.titleHierarchy ?? [];
      const source = result.metadata?.documentFilename ?? "manual entry";
      const header =
        hierarchy.length > 0
          ? `[${hierarchy.join(" > ")}] (fonte: ${source})`
          : `(fonte: ${source})`;
      return `${header}\n${result.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Builds everything the teaching assistant receives on one turn. Shared by the
 * JSON and SSE chat routes so both give the AE the same inputs and capture
 * them the same way.
 */
export async function prepareTeachingAssistantTurn(
  input: PrepareTurnInput
): Promise<PreparedTurn> {
  let modelParams: Record<string, unknown> = {};
  if (input.ta.modelId) {
    const [m] = await db
      .select({ modelParameters: model.modelParameters })
      .from(model)
      .where(eq(model.id, input.ta.modelId))
      .limit(1);
    modelParams = (m?.modelParameters as Record<string, unknown>) ?? {};
  }

  const [solution] = await db
    .select({
      code: challengeSolution.code,
      stdin: challengeSolution.stdin,
      stdout: challengeSolution.stdout,
    })
    .from(challengeSolution)
    .where(
      and(
        eq(challengeSolution.userId, input.userId),
        eq(challengeSolution.challengeId, input.challengeId)
      )
    )
    .limit(1);

  const workspace = {
    code: input.body.code ?? solution?.code ?? null,
    stdin: input.body.stdin ?? solution?.stdin ?? null,
    stdout: input.body.stdout ?? solution?.stdout ?? null,
  };

  // RAG prefetch: the top chunks for the student's message go into the prompt.
  let prefetchResults: KBSearchResult[] = [];
  let prefetchError: string | undefined;
  try {
    prefetchResults = await searchChallengeKnowledgeBases({
      challengeId: input.challengeId,
      query: input.message,
      limit: TA_KB_SEARCH_LIMIT,
      similarityThreshold: TA_KB_SIMILARITY_THRESHOLD,
    });
  } catch (err) {
    prefetchError = err instanceof Error ? err.message : String(err);
    input.onPrefetchError?.(err);
  }
  const prefetch = toRetrieval({
    query: input.message,
    limit: TA_KB_SEARCH_LIMIT,
    threshold: TA_KB_SIMILARITY_THRESHOLD,
    results: prefetchResults,
    error: prefetchError,
  });
  const kbContext = formatKbContext(prefetchResults);

  const supportMaterials = formatSupportMaterials(
    input.challenge?.supportMaterials
  );
  const promptContext: TeachingAssistantPromptContext = {
    systemPrompt: input.ta.systemPrompt,
    targetAudience: input.ta.targetAudience ?? "",
    challengeTitle: input.challenge?.title ?? "",
    challengeDescription: input.challenge?.description ?? "",
    supportMaterials,
    kbContext: kbContext || undefined,
    currentCode: workspace.code ?? "",
    stdout: workspace.stdout ?? "",
    detectedLanguage: detectLanguageHint(input.message),
  };
  const systemPrompt = buildTeachingAssistantPrompt(promptContext);

  // Conversation memory: the last chat turns of this session, oldest first.
  const historyRows = (
    await db
      .select({
        id: userInteractionOnChallenge.id,
        userPrompt: userInteractionOnChallenge.userPrompt,
        modelResponse: userInteractionOnChallenge.modelResponse,
      })
      .from(userInteractionOnChallenge)
      .where(
        and(
          eq(userInteractionOnChallenge.workSessionId, input.workSessionId),
          eq(userInteractionOnChallenge.interactionType, "chat")
        )
      )
      .orderBy(
        desc(userInteractionOnChallenge.createdAt),
        desc(userInteractionOnChallenge.id)
      )
      .limit(TA_HISTORY_TURN_CAP)
  ).reverse();

  const historyMessages = historyRows.flatMap((row) => {
    const msgs: BaseMessage[] = [];
    if (row.userPrompt) msgs.push(new HumanMessage(row.userPrompt));
    if (row.modelResponse?.trim()) msgs.push(new AIMessage(row.modelResponse));
    return msgs;
  });

  const llm = createLlm(modelParams);
  const collector = createTurnCollector();

  return {
    systemPrompt,
    promptContext,
    inputMessages: [
      new SystemMessage(systemPrompt),
      ...historyMessages,
      new HumanMessage(input.message),
    ],
    historyInteractionIds: historyRows.map((row) => row.id),
    prefetch,
    collector,
    llm,
    agent: buildTeachingAssistantAgent(llm),
    configurable: {
      thread_id: input.workSessionId,
      challengeId: input.challengeId,
      challengeContext: {
        title: promptContext.challengeTitle,
        description: promptContext.challengeDescription,
        supportMaterials,
      },
      turnCapture: collector,
    },
    workspace,
  };
}
