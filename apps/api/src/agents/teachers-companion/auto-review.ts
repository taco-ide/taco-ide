import { eq, asc, and, ne } from "drizzle-orm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  submission,
  challenge,
  userInteractionOnChallenge,
  challengeReferenceSolution,
  type GenerationProvider,
} from "@repo/infra/db/schema";
import {
  createOpenRouterLlm,
  AGENT_TIMEOUT_MS,
  AgentTimeoutError,
} from "../llm-factory";
import { isPdcEnabled, runPdcWorkflow } from "../pdc-client";
import {
  AutoReviewStructured,
  AutoReviewStructuredLlm,
  renderAutoReviewMarkdown,
} from "./auto-review-schema";
import { ADAPT_PDC_REVIEW_PROMPT, REVIEW_PROMPT } from "./generation-prompts";
import { parsePdcReview } from "./pdc-parsers";

const MAX_INTERACTIONS_FOR_REVIEW = 40;
const PDC_TIMEOUT_MS = 120_000;
const INVALID_REVIEW_MESSAGE =
  "O agente devolveu um parecer fora do formato esperado.";

type SubmissionForReview = {
  id: string;
  workSessionId: string;
  challengeId: string;
  code: string | null;
  stdin: string | null;
  stdout: string | null;
};

type ChallengeForReview = { title: string; description: string | null };

type ReviewOutcome = {
  json: AutoReviewStructured | null;
  markdown: string;
  provider: GenerationProvider;
};

class InvalidReviewError extends Error {
  constructor() {
    super(INVALID_REVIEW_MESSAGE);
    this.name = "InvalidReviewError";
  }
}

/**
 * Claim the submission and run the teacher's-companion auto-review in the
 * background. Resolves once the claim is persisted, so an HTTP handler can
 * answer right away while the UI already sees `running`. `done` never
 * rejects: failures are persisted as autoReviewStatus = "failed".
 */
export async function startAutoReview(
  submissionId: string,
): Promise<{ started: boolean; done: Promise<void> }> {
  const notStarted = { started: false, done: Promise.resolve() };

  const [sub] = await db
    .select({
      id: submission.id,
      workSessionId: submission.workSessionId,
      challengeId: submission.challengeId,
      code: submission.code,
      stdin: submission.stdin,
      stdout: submission.stdout,
    })
    .from(submission)
    .where(eq(submission.id, submissionId))
    .limit(1);

  if (!sub) {
    console.warn(`[auto-review] submission ${submissionId} not found, skipping`);
    return notStarted;
  }

  // Atomically claim this submission for review. The update only matches
  // when it isn't already running, so two concurrent triggers can't both
  // invoke the LLM (issue #96). An empty `returning()` means another run
  // owns it — skip. Stale "running" rows from a crashed process are cleared
  // on startup by recoverStaleRunningJobs (issue #95).
  const claimed = await db
    .update(submission)
    .set({ autoReviewStatus: "running" })
    .where(
      and(
        eq(submission.id, submissionId),
        ne(submission.autoReviewStatus, "running"),
      ),
    )
    .returning({ id: submission.id });

  if (claimed.length === 0) {
    console.warn(
      `[auto-review] submission ${submissionId} already running, skipping duplicate run`,
    );
    return notStarted;
  }

  return { started: true, done: review(sub) };
}

/**
 * Run the auto-review for a submission and wait for it. All errors are
 * caught and logged — the caller is fire-and-forget.
 */
export async function runAutoReview(submissionId: string): Promise<void> {
  try {
    const { done } = await startAutoReview(submissionId);
    await done;
  } catch (err) {
    console.error(`[auto-review] failed to start for ${submissionId}:`, err);
  }
}

async function review(sub: SubmissionForReview): Promise<void> {
  try {
    const [ch] = await db
      .select({
        title: challenge.title,
        description: challenge.description,
      })
      .from(challenge)
      .where(eq(challenge.id, sub.challengeId))
      .limit(1);

    const humanMessage = await buildReviewContext(sub, ch);

    // Without code the PDC would read the payload as an answer-key request.
    const pdcOutcome =
      isPdcEnabled("review") && sub.code?.trim()
        ? await reviewWithPdc(sub, ch, humanMessage)
        : null;
    const outcome = pdcOutcome ?? (await reviewWithOpenRouter(humanMessage));

    await db
      .update(submission)
      .set({
        autoReview: outcome.markdown,
        autoReviewJson: outcome.json,
        autoReviewAt: new Date(),
        autoReviewStatus: "complete",
        autoReviewError: null,
        autoReviewProvider: outcome.provider,
      })
      .where(eq(submission.id, sub.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(submission)
      .set({
        autoReviewStatus: "failed",
        autoReviewError: message,
      })
      .where(eq(submission.id, sub.id))
      .catch((dbErr) =>
        console.error(
          `[auto-review] failed to persist error status for ${sub.id}:`,
          dbErr
        )
      );
    console.error(`[auto-review] failed for ${sub.id}:`, err);
  }
}

async function buildReviewContext(
  sub: SubmissionForReview,
  ch: ChallengeForReview | undefined,
): Promise<string> {
  const interactions = await db
    .select({
      interactionType: userInteractionOnChallenge.interactionType,
      userPrompt: userInteractionOnChallenge.userPrompt,
      modelResponse: userInteractionOnChallenge.modelResponse,
    })
    .from(userInteractionOnChallenge)
    .where(eq(userInteractionOnChallenge.workSessionId, sub.workSessionId))
    .orderBy(asc(userInteractionOnChallenge.createdAt))
    .limit(MAX_INTERACTIONS_FOR_REVIEW);

  const refRows = await db
    .select({
      kind: challengeReferenceSolution.kind,
      code: challengeReferenceSolution.code,
    })
    .from(challengeReferenceSolution)
    .where(
      and(
        eq(challengeReferenceSolution.challengeId, sub.challengeId),
        eq(challengeReferenceSolution.status, "complete"),
      ),
    );

  const referenceSolutionsBlock =
    refRows.length === 0
      ? "(não fornecidas)"
      : refRows
          .map(
            (r) =>
              `### Solução de referência — ${r.kind}\n\`\`\`python\n${r.code ?? ""}\n\`\`\``,
          )
          .join("\n\n");

  const conversation = interactions
    .map((i, idx) => {
      const tag = i.interactionType === "code_run" ? "EXECUÇÃO" : "CHAT";
      return `### ${idx + 1}. ${tag}\nAluno: ${i.userPrompt}\nTA: ${i.modelResponse}`;
    })
    .join("\n\n");

  return [
    `# Desafio`,
    `Título: ${ch?.title ?? "(desconhecido)"}`,
    `Enunciado: ${ch?.description ?? "(sem enunciado)"}`,
    `Soluções de referência:\n${referenceSolutionsBlock}`,
    ``,
    `# Submissão do aluno`,
    `## Código`,
    "```python",
    sub.code ?? "(sem código)",
    "```",
    sub.stdin ? `## stdin\n\`\`\`\n${sub.stdin}\n\`\`\`` : "",
    sub.stdout ? `## stdout\n\`\`\`\n${sub.stdout}\n\`\`\`` : "",
    ``,
    `# Histórico de interação com o TA`,
    conversation || "(sem interações registradas)",
    ``,
    `Por favor, gere a avaliação seguindo o formato indicado.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * PDC review, then restructured for the teacher: OpenRouter adapter first,
 * deterministic parser second, raw markdown last. Returns null only when the
 * PDC itself fails, so the caller falls back to a full OpenRouter review.
 */
async function reviewWithPdc(
  sub: SubmissionForReview,
  ch: ChallengeForReview | undefined,
  context: string,
): Promise<ReviewOutcome | null> {
  let markdown: string;
  try {
    // Only the statement and the code: the PDC link is not encrypted, so the
    // TA conversation stays with us.
    markdown = await runPdcWorkflow(
      {
        codigo_aluno: sub.code,
        exercicio: {
          challenge: {
            title: ch?.title ?? "",
            description: ch?.description ?? "",
            language: "python",
          },
        },
      },
      { timeoutMs: PDC_TIMEOUT_MS },
    );
  } catch (err) {
    console.warn(
      `[auto-review] PDC failed for ${sub.id}, using OpenRouter:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  try {
    const json = await invokeStructuredReview(
      ADAPT_PDC_REVIEW_PROMPT,
      `# Revisão original\n${markdown}\n\n${context}`,
    );
    return {
      json,
      markdown: renderAutoReviewMarkdown(json),
      provider: "pdc+openrouter",
    };
  } catch (err) {
    console.warn(
      `[auto-review] OpenRouter adapter failed for ${sub.id}, parsing PDC markdown:`,
      err instanceof Error ? err.message : err,
    );
  }

  const parsed = parsePdcReview(markdown);
  if (parsed) {
    return {
      json: parsed,
      markdown: renderAutoReviewMarkdown(parsed),
      provider: "pdc+parser",
    };
  }
  return { json: null, markdown, provider: "pdc+raw" };
}

async function reviewWithOpenRouter(context: string): Promise<ReviewOutcome> {
  const json = await invokeStructuredReview(REVIEW_PROMPT, context);
  return {
    json,
    markdown: renderAutoReviewMarkdown(json),
    provider: "openrouter",
  };
}

async function invokeStructuredReview(
  systemPrompt: string,
  humanMessage: string,
): Promise<AutoReviewStructured> {
  const llm = createOpenRouterLlm({
    temperature: 0,
    max_tokens: 2048,
  }).withStructuredOutput(AutoReviewStructuredLlm, { name: "auto_review" });

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new AgentTimeoutError(AGENT_TIMEOUT_MS));
  }, AGENT_TIMEOUT_MS);

  let structured: unknown;
  try {
    structured = await llm.invoke(
      [new SystemMessage(systemPrompt), new HumanMessage(humanMessage)],
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timeout);
  }

  const parsed = AutoReviewStructuredLlm.safeParse(structured);
  if (!parsed.success) {
    console.warn(
      `[auto-review] structured output failed validation:`,
      parsed.error.flatten()
    );
    throw new InvalidReviewError();
  }
  return parsed.data;
}
