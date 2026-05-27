import { eq, and } from "drizzle-orm";
import { db } from "@repo/infra/db";
import {
  challenge,
  challengeReferenceSolution,
} from "@repo/infra/db/schema";
import { createLlm } from "../llm-factory";
import { randomUUID } from "node:crypto";

type Kind = "brute_force" | "refined";
const ALL_KINDS: Kind[] = ["brute_force", "refined"];

const prompts: Record<Kind, (title: string, description: string) => string> = {
  brute_force: (title, description) =>
    `Você é um(a) professor(a) preparando uma solução de referência para um exercício de Python.

Exercício: ${title}

Descrição:
${description}

Gere a solução BRUTE-FORCE mais simples possível em Python. Priorize CLAREZA e CORREÇÃO sobre eficiência. Use loops/condicionais diretos, sem truques. O código deve ser legível por iniciantes.

Responda APENAS com o código Python — sem cercas markdown (\`\`\`), sem comentários extras, sem explicações. Deve ser um programa/função completo e executável.`,
  refined: (title, description) =>
    `Você é um(a) professor(a) preparando uma solução de referência para um exercício de Python.

Exercício: ${title}

Descrição:
${description}

Gere uma solução IDIOMÁTICA e de qualidade de produção em Python. Use built-ins, list/dict comprehensions e a biblioteca padrão quando natural. Priorize clareza e correção, mas escolha algoritmos eficientes apropriados para mostrar à turma como "bom código".

Responda APENAS com o código Python — sem cercas markdown (\`\`\`), sem comentários extras, sem explicações. Deve ser um programa/função completo e executável.`,
};

/**
 * Generate reference solutions for a challenge (fire-and-forget).
 * Never throws; all errors are logged and persisted to the database.
 */
export async function generateReferenceSolutions(
  challengeId: string,
  kinds: Kind[] = ALL_KINDS,
): Promise<void> {
  const [chal] = await db
    .select({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
    })
    .from(challenge)
    .where(eq(challenge.id, challengeId))
    .limit(1);
  if (!chal) {
    console.warn(`[reference-solution] challenge not found: ${challengeId}`);
    return;
  }

  for (const kind of kinds) {
    await runOneKind(chal, kind).catch((err) => {
      console.error(
        `[reference-solution] uncaught error for ${challengeId}/${kind}:`,
        err,
      );
    });
  }
}

async function runOneKind(
  chal: { id: string; title: string; description: string | null },
  kind: Kind,
): Promise<void> {
  // 1. Upsert running row
  await db
    .insert(challengeReferenceSolution)
    .values({
      id: randomUUID(),
      challengeId: chal.id,
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
    });

  try {
    // TEMP(no-4o-mini): The only Azure deployment in this resource is
    // gpt-5.2-chat, which rejects custom `temperature` and `max_tokens`. Fall
    // back to the default chat model with no overrides until a non-reasoning
    // deterministic model (e.g. gpt-4o-mini) is deployed. Revert to
    // `createLlm({ model: env.LLM_DETERMINISTIC_MODEL_NAME, temperature: 0.2,
    // max_tokens: 1024 })` once that deployment exists.
    const llm = createLlm();
    const prompt = prompts[kind](chal.title, chal.description ?? "");
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

    await persist(chal.id, kind, {
      code: text.trim(),
      status: "complete",
      error: null,
      generatedAt: new Date(),
    });
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
