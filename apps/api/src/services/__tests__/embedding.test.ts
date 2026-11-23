import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateEmbeddings, generateQueryEmbedding } from "../embedding";
import { EmbeddingUnavailableError } from "../embedding-errors";

const mocks = vi.hoisted(() => ({
  env: {
    EMBEDDING_PROVIDER: "openai" as "openai" | "azure" | undefined,
    EMBEDDING_API_URL: "https://embedding.test/v1/embeddings" as
      | string
      | undefined,
    EMBEDDING_API_KEY: "test-key" as string | undefined,
    EMBEDDING_MODEL: "text-embedding-3-small",
    EMBEDDING_DIMENSIONS: 3,
  },
}));
vi.mock("@repo/infra/env", () => ({ env: mocks.env }));

const fetchMock = vi.fn<typeof fetch>();

function embeddingResponse(vectors: number[][]) {
  return new Response(
    JSON.stringify({
      data: vectors.map((embedding, index) => ({ index, embedding })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("embedding service", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.env.EMBEDDING_API_URL = "https://embedding.test/v1/embeddings";
    mocks.env.EMBEDDING_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("generateQueryEmbedding", () => {
    it("returns the embedding when the service responds", async () => {
      fetchMock.mockResolvedValueOnce(embeddingResponse([[0.1, 0.2, 0.3]]));
      await expect(generateQueryEmbedding("loops")).resolves.toEqual([
        0.1, 0.2, 0.3,
      ]);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("throws EmbeddingUnavailableError on an HTTP error", async () => {
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 502 }));
      const err = await generateQueryEmbedding("loops").catch((e) => e);
      expect(err).toBeInstanceOf(EmbeddingUnavailableError);
      expect(err).toMatchObject({ reason: "http_error", status: 502 });
    });

    it("throws EmbeddingUnavailableError on a network error", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      const err = await generateQueryEmbedding("loops").catch((e) => e);
      expect(err).toBeInstanceOf(EmbeddingUnavailableError);
      expect(err).toMatchObject({ reason: "network_error" });
    });

    it("throws EmbeddingUnavailableError when the payload has no embedding", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );
      await expect(generateQueryEmbedding("loops")).rejects.toMatchObject({
        name: "EmbeddingUnavailableError",
        reason: "invalid_response",
      });
    });

    it("throws invalid_response when an HTTP 200 payload has no data array", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ object: "list" }), { status: 200 })
      );
      await expect(generateQueryEmbedding("loops")).rejects.toMatchObject({
        name: "EmbeddingUnavailableError",
        reason: "invalid_response",
        message: expect.stringMatching(/data array/i),
      });
    });

    it("throws EmbeddingUnavailableError when the service is not configured", async () => {
      mocks.env.EMBEDDING_API_URL = undefined;
      await expect(generateQueryEmbedding("loops")).rejects.toMatchObject({
        name: "EmbeddingUnavailableError",
        reason: "not_configured",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("generateEmbeddings (indexing, best-effort)", () => {
    it("keeps returning nulls instead of throwing when the service fails", async () => {
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
      await expect(generateEmbeddings(["a", "b"])).resolves.toEqual([
        null,
        null,
      ]);
    });

    it("keeps returning nulls on network errors", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      await expect(generateEmbeddings(["a"])).resolves.toEqual([null]);
    });

    it("logs a warning and returns nulls when an HTTP 200 payload has no data array", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ object: "list" }), { status: 200 })
      );
      await expect(generateEmbeddings(["a", "b"])).resolves.toEqual([
        null,
        null,
      ]);
      expect(console.warn).toHaveBeenCalledWith(
        "[Embedding] Batch 0 failed:",
        expect.stringMatching(/data array/i)
      );
    });

    it("nulls only the chunks of the batch that failed", async () => {
      // 150 texts → two batches of 100 and 50; the first batch fails.
      const texts = Array.from({ length: 150 }, (_, i) => `chunk ${i}`);
      fetchMock
        .mockResolvedValueOnce(new Response("boom", { status: 500 }))
        .mockResolvedValueOnce(
          embeddingResponse(texts.slice(100).map((_, i) => [i, 0, 0]))
        );

      const results = await generateEmbeddings(texts);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(150);
      expect(results.slice(0, 100).every((r) => r === null)).toBe(true);
      expect(results.slice(100)).toEqual(
        texts.slice(100).map((_, i) => [i, 0, 0])
      );
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledWith(
        "[Embedding] Batch 0 failed:",
        expect.stringMatching(/status 500/)
      );
    });

    it("returns embeddings in input order on success", async () => {
      fetchMock.mockResolvedValueOnce(
        embeddingResponse([
          [1, 0, 0],
          [0, 1, 0],
        ])
      );
      await expect(generateEmbeddings(["a", "b"])).resolves.toEqual([
        [1, 0, 0],
        [0, 1, 0],
      ]);
    });
  });
});
