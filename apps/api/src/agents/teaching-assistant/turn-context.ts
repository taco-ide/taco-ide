import { createHash } from "node:crypto";
import {
  mapChatMessagesToStoredMessages,
  type AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  taTurnContext,
  taTurnContextValuesSchema,
  userInteractionOnChallenge,
  TA_TURN_CONTEXT_SCHEMA_VERSION,
  type NewUserInteractionOnChallenge,
  type TaPromptContext,
  type TaRetrieval,
  type TaTurnContextValues,
  type TaTurnLlm,
} from "@repo/infra/db/schema";
import type { KBSearchResult } from "../../services/knowledge-base-search";

/**
 * Per-turn sink that tools write to through `configurable.turnCapture`, for
 * data the model-visible tool output does not carry (e.g. chunk ids).
 */
export interface TurnCollector {
  toolRetrievals: TaRetrieval[];
}

export function createTurnCollector(): TurnCollector {
  return { toolRetrievals: [] };
}

export function getTurnCollector(
  configurable: Record<string, unknown> | undefined
): TurnCollector | undefined {
  const candidate = configurable?.turnCapture as TurnCollector | undefined;
  return Array.isArray(candidate?.toolRetrievals) ? candidate : undefined;
}

export function toRetrieval(params: {
  query: string;
  limit: number;
  threshold: number;
  results: KBSearchResult[];
  error?: string;
}): TaRetrieval {
  return {
    query: params.query,
    limit: params.limit,
    threshold: params.threshold,
    chunks: params.results.map((r) => ({
      id: r.id,
      knowledgeBaseId: r.knowledgeBaseId ?? null,
      documentId: r.documentId ?? null,
      chunkIndex: r.chunkIndex ?? null,
      similarity: Number(r.similarity),
      content: r.content,
      metadata: r.metadata ?? null,
    })),
    ...(params.error ? { error: params.error } : {}),
  };
}

/** SHA-256 of the challenge text the AE saw; groups turns by challenge version. */
export function challengeContentHash(prompt: TaPromptContext): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        prompt.challengeTitle,
        prompt.challengeDescription,
        prompt.supportMaterials,
      ])
    )
    .digest("hex");
}

const numberOrNull = (v: unknown) => (typeof v === "number" ? v : null);
const stringOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Reads the request settings off the configured chat model (never the key). */
export function describeRequestedLlm(llm: unknown): TaTurnLlm["requested"] {
  const fields = (llm ?? {}) as Record<string, unknown> & {
    clientConfig?: { baseURL?: unknown };
  };
  const baseUrl = stringOrNull(fields.clientConfig?.baseURL);
  let baseUrlHost: string | null = null;
  if (baseUrl) {
    try {
      baseUrlHost = new URL(baseUrl).host;
    } catch {
      baseUrlHost = null;
    }
  }
  return {
    model: stringOrNull(fields.model),
    temperature: numberOrNull(fields.temperature),
    topP: numberOrNull(fields.topP),
    maxTokens: numberOrNull(fields.maxTokens),
    frequencyPenalty: numberOrNull(fields.frequencyPenalty),
    presencePenalty: numberOrNull(fields.presencePenalty),
    baseUrlHost,
  };
}

function describeResolvedLlm(
  produced: BaseMessage[]
): Pick<TaTurnLlm, "resolved" | "usage"> {
  const aiMessages = produced.filter(
    (m) => m.getType() === "ai"
  ) as AIMessage[];
  const meta = (aiMessages.at(-1)?.response_metadata ?? {}) as Record<
    string,
    unknown
  >;

  let usage: TaTurnLlm["usage"] = null;
  for (const m of aiMessages) {
    if (!m.usage_metadata) continue;
    usage ??= { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    usage.inputTokens += m.usage_metadata.input_tokens ?? 0;
    usage.outputTokens += m.usage_metadata.output_tokens ?? 0;
    usage.totalTokens += m.usage_metadata.total_tokens ?? 0;
  }

  return {
    resolved: {
      modelName: stringOrNull(meta.model_name) ?? stringOrNull(meta.model),
      systemFingerprint: stringOrNull(meta.system_fingerprint),
      finishReason: stringOrNull(meta.finish_reason),
    },
    usage,
  };
}

export interface TurnContextInput {
  interactionId: string;
  appVersion: string | null;
  teachingAssistantId: string;
  challengeId: string;
  systemPrompt: string;
  promptContext: TaPromptContext;
  historyInteractionIds: string[];
  prefetch: TaRetrieval | null;
  collector: TurnCollector;
  llm: unknown;
  /** Messages the agent produced during the turn (after the input messages). */
  producedMessages: BaseMessage[];
  langfuseTraceId: string | null;
}

/** Assembles the `ta_turn_context` row for one turn. Pure. */
export function buildTurnContext(input: TurnContextInput): TaTurnContextValues {
  return {
    interactionId: input.interactionId,
    schemaVersion: TA_TURN_CONTEXT_SCHEMA_VERSION,
    appVersion: input.appVersion,
    teachingAssistantId: input.teachingAssistantId,
    systemPrompt: input.systemPrompt,
    promptContext: input.promptContext,
    challenge: {
      id: input.challengeId,
      contentHash: challengeContentHash(input.promptContext),
    },
    historyInteractionIds: input.historyInteractionIds,
    retrieval: {
      prefetch: input.prefetch,
      toolCalls: input.collector.toolRetrievals,
    },
    llm: {
      requested: describeRequestedLlm(input.llm),
      ...describeResolvedLlm(input.producedMessages),
    },
    trajectory: mapChatMessagesToStoredMessages(input.producedMessages).map(
      (m) => ({ type: m.type, data: { ...m.data } })
    ),
    langfuseTraceId: input.langfuseTraceId,
  };
}

/**
 * Writes the chat interaction and its turn context in one transaction, so an
 * interaction never exists without the inputs that produced it.
 */
export async function persistTurn(
  interaction: NewUserInteractionOnChallenge,
  context: TaTurnContextValues
): Promise<void> {
  const values = taTurnContextValuesSchema.parse(context);
  if (values.interactionId !== interaction.id) {
    throw new Error("Turn context does not belong to this interaction");
  }
  await db.transaction(async (tx) => {
    await tx.insert(userInteractionOnChallenge).values(interaction);
    await tx.insert(taTurnContext).values(values);
  });
}
