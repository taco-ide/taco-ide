import { z } from "zod";

export const AutoReviewProblemSeverity = z.enum(["baixa", "media", "alta"]);
export type AutoReviewProblemSeverity = z.infer<
  typeof AutoReviewProblemSeverity
>;

// LLM output contract: gravidade is mandatory when a model writes the review.
const AutoReviewProblemLlm = z.object({
  tipo: z.string().min(1).describe(
    "Categoria do problema (ex.: correção, qualidade, estilo, autonomia)."
  ),
  gravidade: AutoReviewProblemSeverity.describe(
    "Gravidade pedagógica do problema."
  ),
  linha: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe("Linha aproximada do código, quando aplicável."),
  descricao: z.string().min(1).describe(
    "Descrição curta e objetiva do problema."
  ),
});

// Stored contract: the deterministic PDC parser cannot infer gravidade.
export const AutoReviewProblem = AutoReviewProblemLlm.extend({
  gravidade: AutoReviewProblemSeverity.nullable().optional(),
});
export type AutoReviewProblem = z.infer<typeof AutoReviewProblem>;

const problemasDescription =
  "Problemas identificados, do mais grave ao menos grave (0-6 itens).";

export const AutoReviewStructuredLlm = z.object({
  pontosFortes: z
    .array(z.string().min(1))
    .describe(
      "Lista curta (1-4) de pontos positivos da submissão, em português."
    ),
  problemas: z.array(AutoReviewProblemLlm).describe(problemasDescription),
  sugestoes: z
    .array(z.string().min(1))
    .describe(
      "Sugestões acionáveis para o professor repassar ao aluno (1-5 itens)."
    ),
  avaliacaoGeral: z
    .string()
    .min(1)
    .describe(
      "Parágrafo curto (2-4 frases) com avaliação geral em português."
    ),
});

export const AutoReviewStructured = AutoReviewStructuredLlm.extend({
  problemas: z.array(AutoReviewProblem).describe(problemasDescription),
});
export type AutoReviewStructured = z.infer<typeof AutoReviewStructured>;

/**
 * Render the structured review as markdown so the legacy `autoReview` text
 * column stays populated. The submission detail UI prefers the structured
 * version; the markdown is kept as a fallback when older rows are loaded.
 */
export function renderAutoReviewMarkdown(review: AutoReviewStructured): string {
  const sections: string[] = [];

  sections.push("**Avaliação geral**\n\n" + review.avaliacaoGeral.trim());

  if (review.pontosFortes.length > 0) {
    sections.push(
      "**Pontos fortes**\n\n" +
        review.pontosFortes.map((p) => `- ${p.trim()}`).join("\n")
    );
  }

  if (review.problemas.length > 0) {
    sections.push(
      "**Problemas**\n\n" +
        review.problemas
          .map((p) => {
            const line = p.linha ? ` (linha ${p.linha})` : "";
            const label = [p.tipo, p.gravidade].filter(Boolean).join(" · ");
            return `- _${label}_${line}: ${p.descricao.trim()}`;
          })
          .join("\n")
    );
  }

  if (review.sugestoes.length > 0) {
    sections.push(
      "**Sugestões**\n\n" +
        review.sugestoes.map((s) => `- ${s.trim()}`).join("\n")
    );
  }

  return sections.join("\n\n");
}
