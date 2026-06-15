import { eq, asc, and, ne } from "drizzle-orm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  submission,
  challenge,
  userInteractionOnChallenge,
  challengeReferenceSolution,
} from "@repo/infra/db/schema";
import {
  createLlm,
  AGENT_TIMEOUT_MS,
  AgentTimeoutError,
} from "../llm-factory";
import { env } from "@repo/infra/env";
import {
  AutoReviewStructured,
  renderAutoReviewMarkdown,
} from "./auto-review-schema";

const REVIEW_PROMPT = `\
You are an AI assistant for a programming teacher. Evaluate a student's \
submission for a coding exercise. Produce a structured formative review \
(in Portuguese) following the JSON schema you were given.

Each field captures a distinct pedagogical signal:
- "pontosFortes": what the student got right (correctness, clarity, autonomy).
- "problemas": concrete issues, each with type (correção, qualidade,
  estilo, autonomia, etc.), gravidade (baixa | media | alta) and optional
  line. Order by gravity, most severe first.
- "sugestoes": actionable suggestions the teacher can relay to the student.
- "avaliacaoGeral": 2-4 sentences summarising correctness, quality and
  the student's autonomy based on the TA conversation.

Base every observation on the provided code and conversation — do not
invent execution facts. Be terse and concrete; avoid generic praise.`;

const MAX_INTERACTIONS_FOR_REVIEW = 40;

/**
 * Run the teacher's-companion auto-review for a submission and persist
 * the result back to submission.autoReview. All errors are caught and
 * logged via console.error — the caller is fire-and-forget.
 */
export async function runAutoReview(submissionId: string): Promise<void> {
  try {
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
      console.warn(
        `[auto-review] submission ${submissionId} not found, skipping`
      );
      return;
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
        `[auto-review] submission ${submissionId} already running, skipping duplicate run`
      );
      return;
    }

    const [ch] = await db
      .select({
        title: challenge.title,
        description: challenge.description,
      })
      .from(challenge)
      .where(eq(challenge.id, sub.challengeId))
      .limit(1);

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

    const humanMessage = [
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

    const baseLlm = createLlm({
      model: env.LLM_DETERMINISTIC_MODEL_NAME,
      temperature: 0,
      max_tokens: 2048,
    });
    const llm = baseLlm.withStructuredOutput(AutoReviewStructured, {
      name: "auto_review",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new AgentTimeoutError(AGENT_TIMEOUT_MS));
    }, AGENT_TIMEOUT_MS);

    let structured: AutoReviewStructured;
    try {
      structured = (await llm.invoke(
        [new SystemMessage(REVIEW_PROMPT), new HumanMessage(humanMessage)],
        { signal: controller.signal }
      )) as AutoReviewStructured;
    } finally {
      clearTimeout(timeout);
    }

    const parsed = AutoReviewStructured.safeParse(structured);
    if (!parsed.success) {
      console.warn(
        `[auto-review] structured output failed validation for ${submissionId}:`,
        parsed.error.flatten()
      );
      await db
        .update(submission)
        .set({
          autoReviewStatus: "failed",
          autoReviewError:
            "O agente devolveu um parecer fora do formato esperado.",
        })
        .where(eq(submission.id, submissionId))
        .catch((dbErr) =>
          console.error(
            `[auto-review] failed to persist invalid-schema status for ${submissionId}:`,
            dbErr
          )
        );
      return;
    }

    const reviewJson = parsed.data;
    const reviewMarkdown = renderAutoReviewMarkdown(reviewJson);

    await db
      .update(submission)
      .set({
        autoReview: reviewMarkdown,
        autoReviewJson: reviewJson,
        autoReviewAt: new Date(),
        autoReviewStatus: "complete",
        autoReviewError: null,
      })
      .where(eq(submission.id, submissionId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(submission)
      .set({
        autoReviewStatus: "failed",
        autoReviewError: message,
      })
      .where(eq(submission.id, submissionId))
      .catch((dbErr) =>
        console.error(
          `[auto-review] failed to persist error status for ${submissionId}:`,
          dbErr
        )
      );
    console.error(`[auto-review] failed for ${submissionId}:`, err);
  }
}
