import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchKnowledgeBase } from "../tools";
import { EmbeddingUnavailableError } from "../../../services/embedding-errors";

const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../../../services/knowledge-base-search", () => ({
  searchChallengeKnowledgeBases: mocks.search,
}));

async function runTool() {
  const raw = await searchKnowledgeBase.invoke(
    { query: "loops" },
    { configurable: { challengeId: "challenge-1" } }
  );
  return JSON.parse(raw as string) as {
    unavailable: boolean;
    results: { content: string }[];
    error?: string;
  };
}

describe("searchKnowledgeBase tool", () => {
  beforeEach(() => {
    mocks.search.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("flags the materials as unavailable when the embedding service fails", async () => {
    mocks.search.mockRejectedValueOnce(
      new EmbeddingUnavailableError("network_error", "fetch failed")
    );
    const out = await runTool();
    expect(out.unavailable).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.error).toMatch(/temporarily unavailable/i);
  });

  it("says the materials search is not available in this deployment when embeddings are not configured", async () => {
    mocks.search.mockRejectedValueOnce(
      new EmbeddingUnavailableError("not_configured", "not configured")
    );
    const out = await runTool();
    expect(out.unavailable).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.error).toMatch(/not available in this deployment/i);
    expect(out.error).not.toMatch(/temporarily/i);
  });

  it("reports a generic search failure for non-embedding errors", async () => {
    mocks.search.mockRejectedValueOnce(new Error("connection terminated"));
    const out = await runTool();
    expect(out.unavailable).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.error).toMatch(/search failed/i);
    expect(out.error).not.toMatch(/could not be reached/i);
  });

  it("reports no matches without the unavailable flag", async () => {
    mocks.search.mockResolvedValueOnce([]);
    const out = await runTool();
    expect(out).toEqual({ unavailable: false, results: [] });
  });

  it("returns matching chunks", async () => {
    mocks.search.mockResolvedValueOnce([
      {
        content: "A for loop iterates.",
        similarity: 0.9,
        metadata: { documentFilename: "loops.md", titleHierarchy: ["Loops"] },
      },
    ]);
    const out = await runTool();
    expect(out.unavailable).toBe(false);
    expect(out.results).toEqual([
      {
        content: "A for loop iterates.",
        similarity: 0.9,
        source: "loops.md",
        hierarchy: ["Loops"],
      },
    ]);
  });
});
