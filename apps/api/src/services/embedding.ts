import { env } from "@repo/infra/env";
import { EmbeddingUnavailableError } from "./embedding-errors";

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

const BATCH_SIZE = 100;

/** Embeds one batch, throwing EmbeddingUnavailableError on any failure. */
async function requestEmbeddingBatch(
  batch: string[]
): Promise<(number[] | undefined)[]> {
  if (!env.EMBEDDING_API_URL || !env.EMBEDDING_API_KEY) {
    throw new EmbeddingUnavailableError(
      "not_configured",
      "Embedding service is not configured"
    );
  }

  const provider = detectProvider(env.EMBEDDING_API_URL);

  let response: Response;
  try {
    response = await fetch(env.EMBEDDING_API_URL, {
      method: "POST",
      headers: buildHeaders(provider, env.EMBEDDING_API_KEY),
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL,
        input: batch,
        dimensions: env.EMBEDDING_DIMENSIONS,
      }),
    });
  } catch (err) {
    throw new EmbeddingUnavailableError(
      "network_error",
      `Embedding service request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  if (!response.ok) {
    throw new EmbeddingUnavailableError(
      "http_error",
      `Embedding service responded with status ${response.status}`,
      { status: response.status }
    );
  }

  let json: { data?: Array<{ index: number; embedding: number[] }> } | null;
  try {
    json = (await response.json()) as typeof json;
  } catch (err) {
    throw new EmbeddingUnavailableError(
      "invalid_response",
      "Embedding service returned an unreadable response",
      { cause: err }
    );
  }

  if (!Array.isArray(json?.data)) {
    throw new EmbeddingUnavailableError(
      "invalid_response",
      "Embedding service response has no data array"
    );
  }

  const embeddings: (number[] | undefined)[] = new Array(batch.length);
  for (const item of json.data) {
    if (Array.isArray(item.embedding)) embeddings[item.index] = item.embedding;
  }
  return embeddings;
}

/**
 * Embeds a search query. Unlike `generateEmbedding`, failures are not
 * swallowed: it throws EmbeddingUnavailableError so search callers can report
 * the outage instead of returning an empty result set.
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const [embedding] = await requestEmbeddingBatch([text]);
  if (!embedding) {
    throw new EmbeddingUnavailableError(
      "invalid_response",
      "Embedding service response is missing the embedding"
    );
  }
  return embedding;
}

/**
 * Best-effort embedding for indexing (document upload, manual entries):
 * returns null for texts whose batch failed, so indexing can continue and
 * the chunk is stored without an embedding.
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  const results = await generateEmbeddings([text]);
  return results[0] ?? null;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  if (!env.EMBEDDING_API_URL || !env.EMBEDDING_API_KEY || texts.length === 0) {
    return texts.map(() => null);
  }

  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const embeddings = await requestEmbeddingBatch(batch);
      embeddings.forEach((embedding, j) => {
        if (embedding) results[i + j] = embedding;
      });
    } catch (err) {
      console.warn(
        `[Embedding] Batch ${i / BATCH_SIZE} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return results;
}
