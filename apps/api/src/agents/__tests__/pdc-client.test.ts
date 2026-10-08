import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@repo/infra/env", async () => {
  const actual = (await vi.importActual("@repo/infra/env")) as {
    env: Record<string, unknown>;
  };
  return {
    env: {
      ...actual.env,
      PDC_API_URL: "http://pdc.test",
      PDC_GABARITO_ENABLED: true,
      PDC_REVIEW_ENABLED: false,
    },
  };
});

import { env } from "@repo/infra/env";
import {
  PdcUnavailableError,
  QUEUE_MAX_WAIT_MS,
  isPdcEnabled,
  resetPdcClientForTests,
  runPdcWorkflow,
} from "../pdc-client";

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const finalEvent = (text: string) => [
  { author: "taco_gabarito_workflow", content: { parts: [{ text }] } },
];

function routeFetch(run: Handler): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/health")) return json({ status: "ok" });
    if (url.includes("/sessions/")) return json({});
    if (url.endsWith("/run")) return run(url, init);
    throw new Error(`unexpected url ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const runCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/run"));

describe("pdc-client", () => {
  beforeEach(() => {
    resetPdcClientForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports each flow switch on top of the URL", () => {
    expect(isPdcEnabled("gabarito")).toBe(true);
    expect(isPdcEnabled("review")).toBe(false);
  });

  it("opens a session, posts the payload as text and returns the final text", async () => {
    const fetchMock = routeFetch(async () => json(finalEvent("### Variação: a")));

    const text = await runPdcWorkflow({ challenge: { title: "T" } }, { timeoutMs: 1_000 });

    expect(text).toBe("### Variação: a");
    const [, init] = runCalls(fetchMock)[0]!;
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({ appName: "workflow_taco", userId: "taco-ide" });
    expect(JSON.parse(body.newMessage.parts[0].text)).toEqual({ challenge: { title: "T" } });
    const deletes = fetchMock.mock.calls.filter(([, i]) => i?.method === "DELETE");
    expect(deletes).toHaveLength(1);
  });

  it("tolerates a trailing slash in PDC_API_URL", async () => {
    const original = env.PDC_API_URL;
    (env as { PDC_API_URL?: string }).PDC_API_URL = "http://pdc.test/";
    try {
      const fetchMock = routeFetch(async () => json(finalEvent("ok")));

      await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).resolves.toBe("ok");
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls[0]).toBe("http://pdc.test/health");
      expect(urls.some((u) => u.includes("//apps") || u.endsWith("//run"))).toBe(false);
    } finally {
      (env as { PDC_API_URL?: string }).PDC_API_URL = original;
    }
  });

  it("fails fast and opens the circuit when the health check fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).rejects.toBeInstanceOf(
      PdcUnavailableError,
    );
    await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).rejects.toThrow(
      /circuit breaker/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects queued requests once the circuit opens", async () => {
    let releaseHealth!: () => void;
    const healthGate = new Promise<void>((r) => {
      releaseHealth = r;
    });
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).endsWith("/health")) {
        await healthGate;
        throw new TypeError("fetch failed");
      }
      throw new Error(`unexpected url ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const calls = [1, 2, 3].map(() => runPdcWorkflow({}, { timeoutMs: 1_000 }));
    releaseHealth();
    const results = await Promise.allSettled(calls);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes the session even when its creation times out", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/health")) return json({ status: "ok" });
      if (url.includes("/sessions/") && init?.method === "POST") {
        throw new DOMException("timed out", "TimeoutError");
      }
      if (url.includes("/sessions/") && init?.method === "DELETE") {
        return json({}, 404);
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).rejects.toBeInstanceOf(
      PdcUnavailableError,
    );

    const deletes = fetchMock.mock.calls.filter(([, i]) => i?.method === "DELETE");
    expect(deletes).toHaveLength(1);
  });

  it("rejects HTTP errors and empty answers", async () => {
    routeFetch(async () => json({ detail: "boom" }, 500));
    await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).rejects.toThrow(/HTTP 500/);

    routeFetch(async () => json(finalEvent("   ")));
    await expect(runPdcWorkflow({}, { timeoutMs: 1_000 })).rejects.toThrow(/vazia/);
  });

  it("never sends two requests to the PDC at the same time", async () => {
    let active = 0;
    let maxActive = 0;
    routeFetch(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return json(finalEvent("ok"));
    });

    const results = await Promise.all([
      runPdcWorkflow({}, { timeoutMs: 1_000 }),
      runPdcWorkflow({}, { timeoutMs: 1_000 }),
      runPdcWorkflow({}, { timeoutMs: 1_000 }),
    ]);

    expect(results).toEqual(["ok", "ok", "ok"]);
    expect(maxActive).toBe(1);
  });

  it("overflows a request that waits too long in the queue", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let finishFirst!: () => void;
    routeFetch(
      () =>
        new Promise((resolve) => {
          finishFirst = () => resolve(json(finalEvent("first")));
        }),
    );

    const first = runPdcWorkflow({}, { timeoutMs: 600_000 });
    await vi.waitFor(() => expect(finishFirst).toBeTypeOf("function"));
    const second = runPdcWorkflow({}, { timeoutMs: 600_000 });
    const secondResult = expect(second).rejects.toThrow(/fila/);

    await vi.advanceTimersByTimeAsync(QUEUE_MAX_WAIT_MS + 1);
    await secondResult;

    finishFirst();
    await expect(first).resolves.toBe("first");
  });
});
