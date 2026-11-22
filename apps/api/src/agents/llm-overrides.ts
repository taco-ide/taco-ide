import { z } from "zod";

/**
 * Zod schema for validating LLM parameter overrides.
 * Only these keys are accepted to prevent arbitrary configuration of the LLM.
 *
 * Kept in its own module (no LangChain/env imports) so HTTP routes can
 * validate stored model parameters without pulling in the LLM client.
 */
export const LLMOverridesSchema = z.object({
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
});

export type LLMOverrides = z.infer<typeof LLMOverridesSchema>;
