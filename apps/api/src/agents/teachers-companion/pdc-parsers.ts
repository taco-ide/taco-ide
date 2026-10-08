import { AutoReviewStructured } from "./auto-review-schema";

/**
 * Deterministic parsers for the markdown returned by the PDC workflow_taco
 * API. Reference solutions come as one `### Variação: <label>` section per
 * requested variation; reviews come as three bold-titled sections.
 */

const VARIATION_HEADING = /^#{2,4}\s*Varia[çc][ãa]o:\s*(.+?)\s*$/gim;
const CODE_LABEL = /\*\*C[óo]digo:?\*\*/i;
const FENCED_CODE = /```[\w+-]*\r?\n([\s\S]*?)```/;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.*\S)\s*$/;

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLabel(label: string): string {
  return stripAccents(label).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Extract the code of each variation, keyed by normalised label so that
 * `brute_force`, `brute-force` and `` `brute_force` `` all match.
 */
export function parsePdcAnswerKey(markdown: string): Map<string, string> {
  const codes = new Map<string, string>();
  const headings = [...markdown.matchAll(VARIATION_HEADING)];
  headings.forEach((heading, i) => {
    const start = heading.index! + heading[0].length;
    const end = headings[i + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const codeStart = section.search(CODE_LABEL);
    const code = FENCED_CODE.exec(
      codeStart >= 0 ? section.slice(codeStart) : section,
    )?.[1]?.trim();
    if (code) codes.set(normalizeLabel(heading[1]!), code);
  });
  return codes;
}

export function pdcVariationCode(
  codes: Map<string, string>,
  label: string,
): string | undefined {
  return codes.get(normalizeLabel(label));
}

type ReviewSection = "overall" | "improvements" | "nextSteps";

const REVIEW_SECTIONS: Record<string, ReviewSection> = {
  "avaliacao geral": "overall",
  "pontos de melhoria": "improvements",
  "proximos passos": "nextSteps",
};

function reviewSectionOf(line: string): ReviewSection | null {
  const m = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*([^*_#\n]+?)\s*:?\s*(?:\*\*|__)?\s*:?\s*$/.exec(
    line,
  );
  if (!m) return null;
  return REVIEW_SECTIONS[stripAccents(m[1]!).toLowerCase()] ?? null;
}

function splitReviewSections(markdown: string): Partial<Record<ReviewSection, string>> {
  const sections: Partial<Record<ReviewSection, string[]>> = {};
  let current: ReviewSection | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = reviewSectionOf(line);
    if (heading) {
      current = heading;
      sections[current] = [];
    } else if (current) {
      sections[current]!.push(line);
    }
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines!.join("\n").trim()]),
  );
}

/** Bullet items when the section is a list, otherwise its sentences. */
function toItems(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const bullets = lines
    .map((line) => BULLET.exec(line)?.[1])
    .filter((item): item is string => Boolean(item));
  if (bullets.length > 0) return bullets;
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Last-resort mapping of a PDC review onto AutoReviewStructured, used when
 * the OpenRouter adapter is unavailable. The PDC does not grade problems, so
 * gravidade stays empty and the improvements become a single item. Returns
 * null when the expected sections are missing.
 */
export function parsePdcReview(markdown: string): AutoReviewStructured | null {
  const sections = splitReviewSections(markdown);
  const overall = sections.overall;
  if (!overall) return null;

  const improvements = sections.improvements ?? "";
  const nothingToImprove = /^nenhum/i.test(stripAccents(improvements));

  const parsed = AutoReviewStructured.safeParse({
    avaliacaoGeral: overall,
    pontosFortes: [],
    problemas:
      improvements && !nothingToImprove
        ? [{ tipo: "melhoria", descricao: improvements }]
        : [],
    sugestoes: toItems(sections.nextSteps ?? ""),
  });
  return parsed.success ? parsed.data : null;
}
