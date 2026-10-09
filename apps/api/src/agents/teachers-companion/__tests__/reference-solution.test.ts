/**
 * Tests for the reference-solution generator: PDC first, OpenRouter for
 * whatever the PDC does not deliver.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { challengeReferenceSolution } from "@repo/infra/db/schema";

const invokeMock = vi.fn();
const isPdcEnabledMock = vi.fn((_flow: string) => true);
const runPdcWorkflowMock = vi.fn();

vi.mock("../../llm-factory", async () => {
  const actual = (await vi.importActual("../../llm-factory")) as Record<string, unknown>;
  return { ...actual, createOpenRouterLlm: () => ({ invoke: invokeMock }) };
});

vi.mock("../../pdc-client", () => ({
  isPdcEnabled: (flow: string) => isPdcEnabledMock(flow),
  runPdcWorkflow: (...args: unknown[]) => runPdcWorkflowMock(...args),
}));

import {
  generateReferenceSolutions,
  startReferenceSolutions,
} from "../reference-solution";
import { createChallenge, createUser } from "../../../test/helpers/factories";

const pdcAnswer = (variations: Record<string, string>) =>
  Object.entries(variations)
    .map(
      ([label, code]) =>
        `### Variação: ${label}\n\n**Código:**\n\`\`\`python\n${code}\n\`\`\`\n\n**Validação sintática:** OK`,
    )
    .join("\n\n---\n\n");

describe("generateReferenceSolutions", () => {
  let challengeId: string;

  const readRow = async (kind: "brute_force" | "refined") =>
    (
      await db
        .select()
        .from(challengeReferenceSolution)
        .where(
          and(
            eq(challengeReferenceSolution.challengeId, challengeId),
            eq(challengeReferenceSolution.kind, kind),
          ),
        )
    )[0]!;

  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invokeMock.mockReset();
    runPdcWorkflowMock.mockReset();
    isPdcEnabledMock.mockReset().mockReturnValue(true);
    const teacher = await createUser();
    challengeId = (await createChallenge({ createdByUserId: teacher.id })).id;
  });

  it("asks the PDC once for both kinds and stores its code", async () => {
    runPdcWorkflowMock.mockResolvedValueOnce(
      pdcAnswer({ brute_force: "print(1)", refined: "print(2)" }),
    );

    await generateReferenceSolutions(challengeId);

    expect(runPdcWorkflowMock).toHaveBeenCalledTimes(1);
    const [payload] = runPdcWorkflowMock.mock.calls[0]!;
    expect(payload.variations.map((v: { label: string }) => v.label)).toEqual([
      "brute_force",
      "refined",
    ]);
    expect(payload.solutionsRequested).toBe(2);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(await readRow("brute_force")).toMatchObject({
      code: "print(1)",
      status: "complete",
      provider: "pdc",
    });
    expect((await readRow("refined")).provider).toBe("pdc");
  });

  it("generates only the missing kind with OpenRouter", async () => {
    runPdcWorkflowMock.mockResolvedValueOnce(pdcAnswer({ brute_force: "print(1)" }));
    invokeMock.mockResolvedValueOnce({ content: "print('refined')" });

    await generateReferenceSolutions(challengeId);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect((await readRow("brute_force")).provider).toBe("pdc");
    expect(await readRow("refined")).toMatchObject({
      code: "print('refined')",
      provider: "openrouter",
    });
  });

  it("falls back to OpenRouter for every kind when the PDC fails", async () => {
    runPdcWorkflowMock.mockRejectedValueOnce(new Error("PDC down"));
    invokeMock.mockResolvedValue({ content: "```python\nprint(3)\n```" });

    await generateReferenceSolutions(challengeId);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(await readRow("brute_force")).toMatchObject({
      code: "print(3)",
      status: "complete",
      provider: "openrouter",
    });
  });

  it("skips the PDC when it is disabled", async () => {
    isPdcEnabledMock.mockReturnValue(false);
    invokeMock.mockResolvedValue({ content: "print(4)" });

    await generateReferenceSolutions(challengeId, ["refined"]);

    expect(runPdcWorkflowMock).not.toHaveBeenCalled();
    expect((await readRow("refined")).provider).toBe("openrouter");
  });

  it("marks the kind failed when every path fails", async () => {
    runPdcWorkflowMock.mockRejectedValueOnce(new Error("PDC down"));
    invokeMock.mockRejectedValueOnce(new Error("OpenRouter down"));

    await generateReferenceSolutions(challengeId, ["brute_force"]);

    expect(await readRow("brute_force")).toMatchObject({
      status: "failed",
      error: "OpenRouter down",
    });
  });

  it("still generates the kinds already claimed when a later claim fails", async () => {
    const realInsert = db.insert.bind(db);
    const insertSpy = vi
      .spyOn(db, "insert")
      .mockImplementationOnce(realInsert)
      .mockImplementationOnce(() => {
        throw new Error("db down");
      });
    runPdcWorkflowMock.mockResolvedValueOnce(pdcAnswer({ brute_force: "print(6)" }));

    try {
      await generateReferenceSolutions(challengeId);
    } finally {
      insertSpy.mockRestore();
    }

    expect(await readRow("brute_force")).toMatchObject({
      status: "complete",
      code: "print(6)",
    });
    const [payload] = runPdcWorkflowMock.mock.calls[0]!;
    expect(payload.variations).toHaveLength(1);
  });

  it("start rethrows when no kind could be claimed", async () => {
    const insertSpy = vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("db down");
    });

    try {
      await expect(startReferenceSolutions(challengeId, ["refined"])).rejects.toThrow(
        "db down",
      );
    } finally {
      insertSpy.mockRestore();
    }
  });

  it("start resolves with the claim before the generation finishes", async () => {
    let finish!: (value: string) => void;
    runPdcWorkflowMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );

    const { claimed, done } = await startReferenceSolutions(challengeId, ["refined"]);

    expect(claimed).toEqual(["refined"]);
    expect((await readRow("refined")).status).toBe("running");
    const second = await startReferenceSolutions(challengeId, ["refined"]);
    expect(second.claimed).toEqual([]);

    finish(pdcAnswer({ refined: "print(5)" }));
    await done;
    expect((await readRow("refined")).status).toBe("complete");
  });
});
