import { eq, asc, and } from "drizzle-orm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  submission,
  challenge,
  userInteractionOnChallenge,
  challengeReferenceSolution,
} from "@repo/infra/db/schema";
import { env } from "@repo/infra/env";
import {
  createLlm,
  AGENT_TIMEOUT_MS,
  AgentTimeoutError,
} from "../llm-factory";

const REVIEW_PROMPT = `\
You are an AI assistant for a programming teacher. Evaluate a student's \
submission for a coding exercise. Produce a concise structured review (in \
Portuguese) covering:

1. **Corretude** — does the code solve the problem? Note edge cases or
   logic errors.
2. **Qualidade do código** — clareza, nomes, estrutura, idiomas Python.
3. **Trajetória de aprendizado** — observe a interação com o TA para
   avaliar o grau de autonomia da solução (pediu muitas dicas? copiou? ou
   formulou raciocínio próprio?).
4. **Sugestões para o professor** — feedback construtivo que o
   professor possa repassar ao aluno.

Mantenha entre 4 e 8 parágrafos curtos. Não invente fatos sobre
execução; baseie-se no código e na conversa fornecidos.`;

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

    // Mark as running
    await db
      .update(submission)
      .set({ autoReviewStatus: "running" })
      .where(eq(submission.id, submissionId));

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

    const llm = createLlm({
      model: env.LLM_DETERMINISTIC_MODEL_NAME,
      temperature: 0.2,
      max_tokens: 2048,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new AgentTimeoutError(AGENT_TIMEOUT_MS));
    }, AGENT_TIMEOUT_MS);

    let response;
    try {
      response = await llm.invoke(
        [new SystemMessage(REVIEW_PROMPT), new HumanMessage(humanMessage)],
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const reviewText =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .map((part) =>
                typeof part === "string"
                  ? part
                  : typeof (part as any)?.text === "string"
                    ? (part as any).text
                    : ""
              )
              .join("")
          : "";

    if (!reviewText) {
      console.warn(`[auto-review] empty LLM response for ${submissionId}`);
      await db
        .update(submission)
        .set({
          autoReviewStatus: "failed",
          autoReviewError: "O agente retornou uma resposta vazia.",
        })
        .where(eq(submission.id, submissionId))
        .catch((dbErr) =>
          console.error(
            `[auto-review] failed to persist empty-response status for ${submissionId}:`,
            dbErr
          )
        );
      return;
    }

    await db
      .update(submission)
      .set({
        autoReview: reviewText,
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
