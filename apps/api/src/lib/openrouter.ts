/**
 * OpenRouter API client for chat completions
 * Docs: https://openrouter.ai/docs/api-reference/chat-completion
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "x-ai/grok-4.1-fast";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    messages,
    maxTokens = 2048,
    temperature = 0.7,
  } = options;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.BETTER_AUTH_URL || "http://localhost:3344",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    message?: string;
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  if (!res.ok) {
    const errMsg =
      data?.error?.message || data?.message || `OpenRouter error: ${res.status}`;
    throw new Error(errMsg);
  }

  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("Empty or invalid response from OpenRouter");
  }

  return {
    content: choice.message.content,
    model: data.model || model,
    usage: data.usage,
  };
}
