import { z } from "zod";

// Shapes of the jsonb columns of `ta_turn_context` (see app.ts). Bump
// TA_TURN_CONTEXT_SCHEMA_VERSION whenever one of these shapes changes, so
// rows written under an older shape can still be told apart.
export const TA_TURN_CONTEXT_SCHEMA_VERSION = 1;

/**
 * The object handed to `buildTeachingAssistantPrompt`, stored verbatim.
 * `passthrough` keeps fields added to the prompt builder later.
 */
export const taPromptContextSchema = z
  .object({
    systemPrompt: z.string(),
    targetAudience: z.string(),
    challengeTitle: z.string(),
    challengeDescription: z.string(),
    supportMaterials: z.string(),
    kbContext: z.string().optional(),
    currentCode: z.string(),
    stdout: z.string(),
    detectedLanguage: z.string().optional(),
  })
  .passthrough();

/** Which challenge the turn ran against, and a hash of the text the AE saw. */
export const taTurnChallengeSchema = z.object({
  id: z.string(),
  contentHash: z.string(),
});

export const taRetrievedChunkSchema = z.object({
  id: z.string(),
  knowledgeBaseId: z.string().nullable(),
  documentId: z.string().nullable(),
  chunkIndex: z.number().int().nullable(),
  similarity: z.number(),
  // Chunks can be edited in place, so the text is stored, not only the id.
  content: z.string(),
  metadata: z.record(z.unknown()).nullable(),
});

/** One knowledge-base search: the prefetch, or one `searchKnowledgeBase` tool call. */
export const taRetrievalSchema = z.object({
  query: z.string(),
  limit: z.number().int(),
  threshold: z.number(),
  chunks: z.array(taRetrievedChunkSchema),
  error: z.string().optional(),
});

export const taTurnRetrievalSchema = z.object({
  prefetch: taRetrievalSchema.nullable(),
  toolCalls: z.array(taRetrievalSchema),
});

export const taTurnLlmSchema = z.object({
  /** What the API asked for, read from the configured chat model. Never holds the key. */
  requested: z.object({
    model: z.string().nullable(),
    temperature: z.number().nullable(),
    topP: z.number().nullable(),
    maxTokens: z.number().nullable(),
    frequencyPenalty: z.number().nullable(),
    presencePenalty: z.number().nullable(),
    baseUrlHost: z.string().nullable(),
  }),
  /** What the provider reported on the final answer. */
  resolved: z.object({
    modelName: z.string().nullable(),
    systemFingerprint: z.string().nullable(),
    finishReason: z.string().nullable(),
  }),
  /** Summed over every model call in the turn. */
  usage: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    })
    .nullable(),
});

/** A LangChain `StoredMessage` (`mapChatMessagesToStoredMessages`). */
export const taStoredMessageSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
});

export const taTurnContextValuesSchema = z.object({
  interactionId: z.string().min(1),
  schemaVersion: z.literal(TA_TURN_CONTEXT_SCHEMA_VERSION),
  appVersion: z.string().nullable(),
  teachingAssistantId: z.string().min(1),
  systemPrompt: z.string(),
  promptContext: taPromptContextSchema,
  challenge: taTurnChallengeSchema,
  historyInteractionIds: z.array(z.string()),
  retrieval: taTurnRetrievalSchema,
  llm: taTurnLlmSchema,
  trajectory: z.array(taStoredMessageSchema),
  langfuseTraceId: z.string().nullable(),
});

export type TaPromptContext = z.infer<typeof taPromptContextSchema>;
export type TaTurnChallenge = z.infer<typeof taTurnChallengeSchema>;
export type TaRetrievedChunk = z.infer<typeof taRetrievedChunkSchema>;
export type TaRetrieval = z.infer<typeof taRetrievalSchema>;
export type TaTurnRetrieval = z.infer<typeof taTurnRetrievalSchema>;
export type TaTurnLlm = z.infer<typeof taTurnLlmSchema>;
export type TaStoredMessage = z.infer<typeof taStoredMessageSchema>;
export type TaTurnContextValues = z.infer<typeof taTurnContextValuesSchema>;
