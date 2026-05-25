import { eq, asc } from "drizzle-orm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { db } from "@repo/infra/db";
import {
  submission,
  challenge,
  userInteractionOnChallenge,
} from "@repo/infra/db/schema";
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

    const [ch] = await db
      .select({
        title: challenge.title,
        description: challenge.description,
        possibleSolutions: challenge.possibleSolutions,
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

    const possibleSolutionsText =
      ch?.possibleSolutions === null || ch?.possibleSolutions === undefined
        ? ""
        : typeof ch.possibleSolutions === "string"
          ? ch.possibleSolutions
          : JSON.stringify(ch.possibleSolutions);

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
      possibleSolutionsText
        ? `Soluções de referência:\n${possibleSolutionsText}`
        : "Soluções de referência: (não fornecidas)",
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

    const llm = createLlm({ temperature: 0.2, max_tokens: 2048 });
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
                  : "text" in part && typeof part.text === "string"
                    ? part.text
                    : ""
              )
              .join("")
          : "";

    if (!reviewText) {
      console.warn(`[auto-review] empty LLM response for ${submissionId}`);
      return;
    }

    await db
      .update(submission)
      .set({
        autoReview: reviewText,
        autoReviewAt: new Date(),
      })
      .where(eq(submission.id, submissionId));
  } catch (err) {
    console.error(`[auto-review] failed for ${submissionId}:`, err);
  }
}
