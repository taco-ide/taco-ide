import { describe, it, expect } from "vitest";
import {
  parsePdcAnswerKey,
  parsePdcReview,
  pdcVariationCode,
} from "../pdc-parsers";
import {
  PDC_ANSWER_KEY_NO_EXAMPLES,
  PDC_ANSWER_KEY_TWO_VARIATIONS,
  PDC_REVIEW_NOTHING_TO_IMPROVE,
  PDC_REVIEW_WITH_LIST,
} from "./fixtures/pdc-responses";

describe("parsePdcAnswerKey", () => {
  it("extracts the code of each variation from a real PDC answer", () => {
    const codes = parsePdcAnswerKey(PDC_ANSWER_KEY_TWO_VARIATIONS);

    expect(pdcVariationCode(codes, "leitura-direta")).toBe(
      "a = int(input())\nb = int(input())\nprint(a + b)",
    );
    expect(pdcVariationCode(codes, "com-funcao")).toContain("def somar(a, b):");
    expect(codes.size).toBe(2);
  });

  it("keeps the code block even when example validation was skipped", () => {
    const codes = parsePdcAnswerKey(PDC_ANSWER_KEY_NO_EXAMPLES);

    expect(pdcVariationCode(codes, "condicionais")).toMatch(/^# Implementa/);
    expect(pdcVariationCode(codes, "ordenacao")).toContain("valores.sort()");
  });

  it("matches labels regardless of separators and formatting", () => {
    const codes = parsePdcAnswerKey(
      "### Variação: `brute-force`\n\n**Código:**\n```python\nprint(1)\n```\n",
    );

    expect(pdcVariationCode(codes, "brute_force")).toBe("print(1)");
  });

  it("keeps code that contains triple backticks inside a string", () => {
    const codes = parsePdcAnswerKey(
      '### Variação: refined\n\n**Código:**\n```python\nprint("```")\nprint(2)\n```\n\n**Validação sintática:** OK',
    );

    expect(pdcVariationCode(codes, "refined")).toBe('print("```")\nprint(2)');
  });

  it("ignores a variation without a code block", () => {
    const codes = parsePdcAnswerKey(
      "### Variação: refined\n\nNão foi possível gerar.\n\n### Variação: brute_force\n\n```python\nx = 1\n```",
    );

    expect(pdcVariationCode(codes, "refined")).toBeUndefined();
    expect(pdcVariationCode(codes, "brute_force")).toBe("x = 1");
  });

  it("returns an empty map for unrelated text", () => {
    expect(parsePdcAnswerKey("Erro interno").size).toBe(0);
  });
});

describe("parsePdcReview", () => {
  it("maps the three sections of a real review with a bullet list", () => {
    const review = parsePdcReview(PDC_REVIEW_WITH_LIST);

    expect(review).not.toBeNull();
    expect(review!.avaliacaoGeral).toMatch(/^Muito bom ver/);
    expect(review!.pontosFortes).toEqual([]);
    expect(review!.problemas).toHaveLength(1);
    expect(review!.problemas[0]).toMatchObject({ tipo: "melhoria" });
    expect(review!.problemas[0]!.gravidade).toBeUndefined();
    expect(review!.problemas[0]!.descricao).toContain("int()");
    expect(review!.sugestoes).toHaveLength(3);
    expect(review!.sugestoes[0]).toMatch(/^Pratique converter/);
  });

  it("keeps the improvements text verbatim and splits paragraph suggestions", () => {
    const review = parsePdcReview(PDC_REVIEW_NOTHING_TO_IMPROVE);

    expect(review).not.toBeNull();
    expect(review!.problemas).toHaveLength(1);
    expect(review!.problemas[0]!.descricao).toMatch(/^Nenhum ponto crítico/);
    expect(review!.sugestoes.length).toBeGreaterThan(1);
    expect(review!.sugestoes[0]).toMatch(/^Continue praticando/);
  });

  it("does not hide a critique that follows a 'no syntax error' sentence", () => {
    const review = parsePdcReview(
      "**Avaliação Geral**\nLeu a entrada.\n\n**Pontos de melhoria**\nNenhum erro de sintaxe foi encontrado. A soma está errada: input() retorna strings.\n\n**Próximos passos**\n- Converta com int().",
    );

    expect(review!.problemas[0]!.descricao).toContain("A soma está errada");
  });

  it("keeps a critique that merely starts with 'Nenhuma'", () => {
    const review = parsePdcReview(
      "**Avaliação Geral**\nBoa leitura.\n\n**Pontos de melhoria**\nNenhuma validação da entrada é realizada: int(input()) lança ValueError.\n\n**Próximos passos**\n- Trate entradas inválidas.",
    );

    expect(review!.problemas).toEqual([
      {
        tipo: "melhoria",
        descricao: "Nenhuma validação da entrada é realizada: int(input()) lança ValueError.",
      },
    ]);
  });

  it("accepts markdown headings instead of bold titles", () => {
    const review = parsePdcReview(
      "## Avaliação geral\nBom trabalho.\n\n## Pontos de melhoria:\nFalta tratar entrada vazia.\n\n## Próximos passos\n1. Teste com lista vazia.",
    );

    expect(review).toMatchObject({
      avaliacaoGeral: "Bom trabalho.",
      problemas: [{ tipo: "melhoria", descricao: "Falta tratar entrada vazia." }],
      sugestoes: ["Teste com lista vazia."],
    });
  });

  it("returns null when the overall section is missing", () => {
    expect(parsePdcReview("### Variação: refined\n```python\nx=1\n```")).toBeNull();
  });
});
