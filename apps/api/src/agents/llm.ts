import { ChatOpenAI } from "@langchain/openai";
import { env } from "@repo/infra/env";

export const llm = new ChatOpenAI({
  model: env.LLM_MODEL_NAME,
  configuration: {
    baseURL: env.LLM_API_BASE,
    apiKey: env.LLM_API_KEY,
  },
});
