import { randomUUID } from "node:crypto";
import { env } from "@repo/infra/env";

/**
 * Client for the PDC `workflow_taco` API (Google ADK server). It generates
 * reference solutions and reviews student code, answering in markdown.
 *
 * The partner server is a proof of concept: it handles one request at a time
 * and may be down for maintenance. Every call therefore goes through a
 * single-slot queue (overflow after QUEUE_MAX_WAIT_MS), a quick health check
 * and a circuit breaker. Any failure throws PdcUnavailableError so callers
 * fall back to OpenRouter. The queue lives in memory, which holds while the
 * API runs as a single instance.
 */

const APP_NAME = "workflow_taco";
const USER_ID = "taco-ide";
const HEALTH_TIMEOUT_MS = 3_000;
const SESSION_TIMEOUT_MS = 10_000;
const CIRCUIT_OPEN_MS = 60_000;
export const QUEUE_MAX_WAIT_MS = 30_000;

export type PdcFlow = "gabarito" | "review";

export class PdcUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdcUnavailableError";
  }
}

export function isPdcEnabled(flow: PdcFlow): boolean {
  if (!env.PDC_API_URL) return false;
  return flow === "gabarito" ? env.PDC_GABARITO_ENABLED : env.PDC_REVIEW_ENABLED;
}

let circuitOpenUntil = 0;
let busy = false;
const waiters: Array<() => void> = [];

function acquireSlot(maxWaitMs: number): Promise<boolean> {
  if (!busy) {
    busy = true;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const waiter = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      const idx = waiters.indexOf(waiter);
      if (idx >= 0) waiters.splice(idx, 1);
      resolve(false);
    }, maxWaitMs);
    waiters.push(waiter);
  });
}

function releaseSlot(): void {
  const next = waiters.shift();
  if (next) next();
  else busy = false;
}

function openCircuit(): void {
  circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
}

function assertCircuitClosed(): void {
  if (Date.now() < circuitOpenUntil) {
    throw new PdcUnavailableError("PDC marcado como indisponível (circuit breaker)");
  }
}

/** Test-only: clears queue and circuit state between cases. */
export function resetPdcClientForTests(): void {
  circuitOpenUntil = 0;
  busy = false;
  waiters.length = 0;
}

type AdkEvent = {
  author?: string;
  content?: { parts?: Array<{ text?: string }> };
};

/**
 * Send one JSON payload to workflow_taco and return the final markdown text.
 * The workflow picks the task from the payload: `codigo_aluno` means review,
 * otherwise it generates reference solutions.
 */
export async function runPdcWorkflow(
  payload: unknown,
  opts: { timeoutMs: number },
): Promise<string> {
  const baseUrl = env.PDC_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) throw new PdcUnavailableError("PDC_API_URL não configurada");

  assertCircuitClosed();

  if (!(await acquireSlot(QUEUE_MAX_WAIT_MS))) {
    throw new PdcUnavailableError(
      `PDC ocupado: pedido esperou mais de ${QUEUE_MAX_WAIT_MS / 1000}s na fila`,
    );
  }

  const sessionId = randomUUID();
  const sessionUrl = `${baseUrl}/apps/${APP_NAME}/users/${USER_ID}/sessions/${sessionId}`;
  // Set before the POST: a timed-out creation may still exist on the PDC.
  let sessionAttempted = false;
  try {
    // The circuit may have opened while this request waited in the queue.
    assertCircuitClosed();

    try {
      const health = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (!health.ok) throw new Error(`HTTP ${health.status}`);
    } catch (err) {
      openCircuit();
      throw new PdcUnavailableError("Health check do PDC falhou", { cause: err });
    }

    sessionAttempted = true;
    const session = await fetch(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
    if (!session.ok) {
      throw new PdcUnavailableError(`PDC recusou a sessão: HTTP ${session.status}`);
    }

    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName: APP_NAME,
        userId: USER_ID,
        sessionId,
        newMessage: { role: "user", parts: [{ text: JSON.stringify(payload) }] },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      throw new PdcUnavailableError(`PDC respondeu HTTP ${res.status}`);
    }

    const events = (await res.json()) as AdkEvent[];
    const last = Array.isArray(events) ? events.at(-1) : undefined;
    const text = (last?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new PdcUnavailableError("PDC devolveu resposta vazia");
    return text;
  } catch (err) {
    if (err instanceof PdcUnavailableError) throw err;
    throw new PdcUnavailableError(
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  } finally {
    releaseSlot();
    if (sessionAttempted) {
      // Best effort: the PDC keeps every session in memory otherwise. A 404
      // (creation never landed) is fine.
      void fetch(sessionUrl, {
        method: "DELETE",
        signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
      }).catch(() => {});
    }
  }
}
