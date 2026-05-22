import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { env } from "@repo/infra/env";

export const AGENT_TIMEOUT_MS = 60_000;

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
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
});

/**
 * Create an instance of ChatOpenAI with environment defaults merged with provided overrides.
 *
 * @param overrides - Optional LLM parameter overrides (temperature, max_tokens, top_p, frequency_penalty, presence_penalty)
 * @returns A new ChatOpenAI instance configured with validated parameters
 */
export function createLlm(overrides?: unknown): ChatOpenAI {
  const validatedOverrides = overrides
    ? LLMOverridesSchema.parse(overrides)
    : {};

  return new ChatOpenAI({
    model: env.LLM_MODEL_NAME,
    configuration: {
      baseURL: env.LLM_API_BASE,
      apiKey: env.LLM_API_KEY,
    },
    ...validatedOverrides,
  });
}
