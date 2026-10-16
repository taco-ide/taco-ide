import { eq, and, ne } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeReferenceSolution,
  type GenerationProvider,
} from "@repo/infra/db/schema";
import { createOpenRouterLlm } from "../llm-factory";
import { isPdcEnabled, runPdcWorkflow } from "../pdc-client";
import {
  referenceSolutionPrompts,
  referenceSolutionStrategies,
} from "./generation-prompts";
import { parsePdcAnswerKey, pdcVariationCode } from "./pdc-parsers";
import { randomUUID } from "node:crypto";

type Kind = "brute_force" | "refined";
const ALL_KINDS: Kind[] = ["brute_force", "refined"];
const PDC_TIMEOUT_MS = 180_000;
const WHOLE_FENCE = /^```[\w+-]*\r?\n([\s\S]*?)\r?\n?```$/;

type ChallengeForGeneration = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  tags: string[] | null;
};

/**
 * Claim the requested kinds and generate them in the background. Resolves
 * once the claims are persisted, so an HTTP handler can answer right away
 * while the UI already sees `running`. `done` settles when every claimed kind
 * is complete or failed, and never rejects.
 */
export async function startReferenceSolutions(
  challengeId: string,
  kinds: Kind[] = ALL_KINDS,
): Promise<{ claimed: Kind[]; done: Promise<void> }> {
  const [chal] = await db
    .select({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      difficulty: challenge.difficulty,
      tags: challenge.tags,
    })
    .from(challenge)
    .where(eq(challenge.id, challengeId))
    .limit(1);
  if (!chal) {
    console.warn(`[reference-solution] challenge not found: ${challengeId}`);
    return { claimed: [], done: Promise.resolve() };
  }

  // A failed claim must not strand the kinds already claimed in `running`:
  // generate those and surface the error only when nothing was claimed.
  const claimed: Kind[] = [];
  let claimError: unknown;
  for (const kind of kinds) {
    try {
      if (await claimKind(chal.id, kind)) claimed.push(kind);
    } catch (err) {
      claimError ??= err;
      console.error(
        `[reference-solution] failed to claim ${challengeId}/${kind}:`,
        err,
      );
    }
  }
  if (claimed.length === 0 && claimError) throw claimError;

  const done =
    claimed.length === 0
      ? Promise.resolve()
      : generate(chal, claimed).catch((err) => {
          console.error(
            `[reference-solution] uncaught error for ${challengeId}:`,
            err,
          );
        });
  return { claimed, done };
}

/**
 * Generate reference solutions for a challenge (fire-and-forget).
 * Never throws; all errors are logged and persisted to the database.
 */
export async function generateReferenceSolutions(
  challengeId: string,
  kinds: Kind[] = ALL_KINDS,
): Promise<void> {
  try {
    const { done } = await startReferenceSolutions(challengeId, kinds);
    await done;
  } catch (err) {
    console.error(
      `[reference-solution] failed to start generation for ${challengeId}:`,
      err,
    );
  }
}

/**
 * Atomically claim this (challenge, kind) for a run. The conflict update only
 * fires when the row is NOT already running, so two concurrent generations
 * cannot both proceed (issue #96). An empty `returning()` means another run
 * already holds the slot. Stale "running" rows left by a crashed process are
 * cleared on startup by recoverStaleRunningJobs (issue #95), so a non-empty
 * claim always reflects a live run.
 */
async function claimKind(challengeId: string, kind: Kind): Promise<boolean> {
  const claimed = await db
    .insert(challengeReferenceSolution)
    .values({
      id: randomUUID(),
      challengeId,
      kind,
      language: "python",
      status: "running",
      createdBy: "ai",
    })
    .onConflictDoUpdate({
      target: [
        challengeReferenceSolution.challengeId,
        challengeReferenceSolution.kind,
      ],
      set: {
        status: "running",
        error: null,
        createdBy: "ai",
        updatedAt: new Date(),
      },
      setWhere: ne(challengeReferenceSolution.status, "running"),
    })
    .returning({ id: challengeReferenceSolution.id });

  if (claimed.length === 0) {
    console.warn(
      `[reference-solution] ${challengeId}/${kind} already running, skipping duplicate run`,
    );
    return false;
  }
  return true;
}

async function generate(
  chal: ChallengeForGeneration,
  kinds: Kind[],
): Promise<void> {
  const remaining = isPdcEnabled("gabarito")
    ? await generateWithPdc(chal, kinds)
    : kinds;
  for (const kind of remaining) {
    await generateWithOpenRouter(chal, kind);
  }
}

/** One PDC request for all kinds. Returns the kinds it did not deliver. */
async function generateWithPdc(
  chal: ChallengeForGeneration,
  kinds: Kind[],
): Promise<Kind[]> {
  let codes: Map<string, string>;
  try {
    const markdown = await runPdcWorkflow(
      {
        challenge: {
          title: chal.title,
          description: chal.description ?? "",
          language: "python",
          ...(chal.difficulty ? { difficulty: chal.difficulty } : {}),
          ...(chal.tags?.length ? { tags: chal.tags } : {}),
        },
        solutionsRequested: kinds.length,
        variations: kinds.map((kind) => ({
          label: kind,
          strategy: referenceSolutionStrategies[kind],
        })),
      },
      { timeoutMs: PDC_TIMEOUT_MS },
    );
    codes = parsePdcAnswerKey(markdown);
  } catch (err) {
    console.warn(
      `[reference-solution] PDC failed for ${chal.id}, using OpenRouter:`,
      err instanceof Error ? err.message : err,
    );
    return kinds;
  }

  const missing: Kind[] = [];
  for (const kind of kinds) {
    const code = pdcVariationCode(codes, kind);
    if (!code) {
      missing.push(kind);
      continue;
    }
    try {
      await persistComplete(chal.id, kind, code, "pdc");
    } catch (err) {
      console.error(
        `[reference-solution] failed to persist PDC result for ${chal.id}/${kind}:`,
        err,
      );
      missing.push(kind);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `[reference-solution] PDC answer for ${chal.id} lacked: ${missing.join(", ")}`,
    );
  }
  return missing;
}

async function generateWithOpenRouter(
  chal: ChallengeForGeneration,
  kind: Kind,
): Promise<void> {
  try {
    const llm = createOpenRouterLlm({ temperature: 0, max_tokens: 4096 });
    const prompt = referenceSolutionPrompts[kind](chal.title, chal.description ?? "");
    const result = await llm.invoke(prompt);
    const text =
      typeof result.content === "string"
        ? result.content
        : Array.isArray(result.content)
          ? result.content
              .map((c) => (typeof c === "string" ? c : (c as any)?.text ?? ""))
              .join("")
          : "";

    if (!text.trim()) {
      await persist(chal.id, kind, {
        status: "failed",
        error: "O agente retornou uma resposta vazia.",
      });
      return;
    }

    // The prompt forbids markdown fences, but a stray one would break the
    // stored code, so unwrap a response that is a single fenced block.
    const trimmed = text.trim();
    const code = WHOLE_FENCE.exec(trimmed)?.[1]?.trim() ?? trimmed;
    await persistComplete(chal.id, kind, code, "openrouter");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persist(chal.id, kind, {
      status: "failed",
      error: message,
    }).catch((dbErr) =>
      console.error(
        `[reference-solution] failed to persist error for ${chal.id}/${kind}:`,
        dbErr,
      ),
    );
    console.error(
      `[reference-solution] failed for ${chal.id}/${kind}:`,
      err,
    );
  }
}

async function persistComplete(
  challengeId: string,
  kind: Kind,
  code: string,
  provider: GenerationProvider,
) {
  await persist(challengeId, kind, {
    code,
    status: "complete",
    error: null,
    provider,
    generatedAt: new Date(),
  });
}

async function persist(
  challengeId: string,
  kind: Kind,
  patch: Partial<typeof challengeReferenceSolution.$inferInsert>,
) {
  await db
    .update(challengeReferenceSolution)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(challengeReferenceSolution.challengeId, challengeId),
        eq(challengeReferenceSolution.kind, kind),
      ),
    );
}
