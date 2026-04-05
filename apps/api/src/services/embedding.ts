import { env } from "@repo/infra/env";

type EmbeddingProvider = "openai" | "azure";

function detectProvider(url: string): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER) return env.EMBEDDING_PROVIDER;
  return url.includes(".openai.azure.com") || url.includes(".cognitiveservices.azure.com")
    ? "azure"
    : "openai";
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
  const results = await generateEmbeddings([text]);
  return results[0] ?? null;
}

const BATCH_SIZE = 100;

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  if (!env.EMBEDDING_API_URL || !env.EMBEDDING_API_KEY || texts.length === 0) {
    return texts.map(() => null);
  }

  const provider = detectProvider(env.EMBEDDING_API_URL);
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(env.EMBEDDING_API_URL, {
        method: "POST",
        headers: buildHeaders(provider, env.EMBEDDING_API_KEY),
        body: JSON.stringify({
          model: env.EMBEDDING_MODEL,
          input: batch,
          dimensions: env.EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        continue;
      }

      const json = (await response.json()) as {
        data: Array<{ index: number; embedding: number[] }>;
      };

      for (const item of json.data) {
        results[i + item.index] = item.embedding;
      }
    } catch {
      // batch failed, results remain null for these indices
    }
  }

  return results;
}
