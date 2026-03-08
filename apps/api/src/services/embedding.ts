import { env } from "@repo/infra/env";

type EmbeddingProvider = "openai" | "azure";

function detectProvider(url: string): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER) return env.EMBEDDING_PROVIDER;
  return url.includes(".openai.azure.com") ? "azure" : "openai";
}

function buildHeaders(
  provider: EmbeddingProvider,
  apiKey: string
): Record<string, string> {
  const base = { "Content-Type": "application/json" };

  if (provider === "azure") {
    return { ...base, "api-key": apiKey };
  }

  return { ...base, Authorization: `Bearer ${apiKey}` };
}

export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  if (!env.EMBEDDING_API_URL || !env.EMBEDDING_API_KEY) {
    return null;
  }

  const provider = detectProvider(env.EMBEDDING_API_URL);

  try {
    const response = await fetch(env.EMBEDDING_API_URL, {
      method: "POST",
      headers: buildHeaders(provider, env.EMBEDDING_API_KEY),
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL,
        input: text,
        dimensions: env.EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return json.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
