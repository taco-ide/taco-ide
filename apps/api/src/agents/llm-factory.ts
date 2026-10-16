import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { env } from "@repo/infra/env";

export const AGENT_TIMEOUT_MS = 60_000;

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class AgentTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Agent invocation timed out after ${timeoutMs}ms`);
    this.name = "AgentTimeoutError";
  }
}

/**
 * Zod schema for validating LLM parameter overrides.
 * Only these keys are accepted to prevent arbitrary configuration of the LLM.
 */
const LLMOverridesSchema = z.object({
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
});

function buildChatOpenAI(
  defaultModel: string,
  baseURL: string,
  apiKey: string,
  overrides?: unknown,
): ChatOpenAI {
  const o = overrides ? LLMOverridesSchema.parse(overrides) : {};

  // LangChain reads camelCase fields; the snake_case keys stored in
  // modelParameters would otherwise be silently ignored.
  return new ChatOpenAI({
    model: o.model ?? defaultModel,
    temperature: o.temperature,
    maxTokens: o.max_tokens,
    topP: o.top_p,
    frequencyPenalty: o.frequency_penalty,
    presencePenalty: o.presence_penalty,
    configuration: { baseURL, apiKey },
  });
}

/**
 * Create an instance of ChatOpenAI with environment defaults merged with provided overrides.
 *
 * @param overrides - Optional LLM parameter overrides (temperature, max_tokens, top_p, frequency_penalty, presence_penalty)
 * @returns A new ChatOpenAI instance configured with validated parameters
 */
export function createLlm(overrides?: unknown): ChatOpenAI {
  return buildChatOpenAI(
    env.LLM_MODEL_NAME,
    env.LLM_API_BASE,
    env.LLM_API_KEY,
    overrides,
  );
}

/**
 * ChatOpenAI pointed at OpenRouter, used by reference solutions and
 * auto-review when the PDC API is disabled or fails. OpenRouter drops
 * parameters the model does not support (e.g. temperature) instead of failing.
 */
export function createOpenRouterLlm(overrides?: unknown): ChatOpenAI {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY não configurada: fallback do OpenRouter indisponível.",
    );
  }
  return buildChatOpenAI(
    env.OPENROUTER_FALLBACK_MODEL,
    OPENROUTER_BASE_URL,
    env.OPENROUTER_API_KEY,
    overrides,
  );
}
