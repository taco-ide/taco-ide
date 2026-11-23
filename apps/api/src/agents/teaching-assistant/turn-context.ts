import { createHash } from "node:crypto";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  mapChatMessagesToStoredMessages,
  type AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";
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
 * Per-turn sink for data the stored messages do not carry. Tools write to it
 * through `configurable.turnCapture` (e.g. chunk ids); `TurnCaptureHandler`
 * writes each model call's generation info.
 */
export interface TurnCollector {
  toolRetrievals: TaRetrieval[];
  /** `generationInfo` of each model call, in order. */
  generationInfos: Record<string, unknown>[];
}

export function createTurnCollector(): TurnCollector {
  return { toolRetrievals: [], generationInfos: [] };
}

/**
 * When ChatOpenAI streams (the SSE route), it reports the model name, system
 * fingerprint and finish reason only in the generation info, not in the
 * message's response_metadata. This handler keeps that info for the turn.
 */
export class TurnCaptureHandler extends BaseCallbackHandler {
  name = "ta-turn-capture";

  constructor(private readonly collector: TurnCollector) {
    super();
  }

  handleLLMEnd(output: LLMResult) {
    this.collector.generationInfos.push(
      output.generations[0]?.[0]?.generationInfo ?? {}
    );
  }
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
  produced: BaseMessage[],
  collector: TurnCollector
): Pick<TaTurnLlm, "resolved" | "usage"> {
  const aiMessages = produced.filter(
    (m) => m.getType() === "ai"
  ) as AIMessage[];
  const meta = (aiMessages.at(-1)?.response_metadata ?? {}) as Record<
    string,
    unknown
  >;
  // invoke puts these in response_metadata; streaming only in generationInfo.
  const info = collector.generationInfos.at(-1) ?? {};
  const pick = (...keys: string[]) =>
    keys
      .flatMap((key) => [meta[key], info[key]])
      .map(stringOrNull)
      .find((v) => v !== null) ?? null;

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
      modelName: pick("model_name", "model"),
      systemFingerprint: pick("system_fingerprint"),
      finishReason: pick("finish_reason"),
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
      ...describeResolvedLlm(input.producedMessages, input.collector),
    },
    trajectory: mapChatMessagesToStoredMessages(input.producedMessages).map(
      (m) => ({ type: m.type, data: { ...m.data } })
    ),
    langfuseTraceId: input.langfuseTraceId,
  };
}

/** The AE's answer: the trimmed text of the last message the turn produced. */
export function finalAnswerText(produced: BaseMessage[]): string {
  const content = produced.at(-1)?.content;
  if (content === undefined || content === null) return "";
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return text.trim();
}

/**
 * Postgres text and jsonb cannot hold U+0000 (e.g. a program that prints
 * chr(0)). Replace it with U+FFFD so the turn is still stored, visibly marked.
 */
export function withoutNul<T>(value: T): T {
  if (typeof value === "string") {
    return value.split("\u0000").join("�") as T;
  }
  if (Array.isArray(value)) return value.map(withoutNul) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [withoutNul(k), withoutNul(v)])
    ) as T;
  }
  return value;
}

/**
 * Writes the chat interaction and its turn context in one transaction, so an
 * interaction never exists without the inputs that produced it.
 */
export async function persistTurn(
  interaction: NewUserInteractionOnChallenge,
  context: TaTurnContextValues
): Promise<void> {
  const values = withoutNul(taTurnContextValuesSchema.parse(context));
  if (values.interactionId !== interaction.id) {
    throw new Error("Turn context does not belong to this interaction");
  }
  await db.transaction(async (tx) => {
    await tx.insert(userInteractionOnChallenge).values(withoutNul(interaction));
    await tx.insert(taTurnContext).values(values);
  });
}
