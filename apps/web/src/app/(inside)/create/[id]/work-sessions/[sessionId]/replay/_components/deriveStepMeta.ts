import { lineDiff } from "./lineDiff";
import type { ReplayInteraction } from "./deriveReplayState";

/**
 * Metadados por passo do replay, calculados só a partir do que já existe no
 * payload (sem IA). Servem à coluna de navegação: resumo, magnitude da edição,
 * virada de saída, marcos e quais passos merecem destaque (⭐).
 *
 * Importante: no app real o `code` só é gravado nas interações `code_run`
 * (chat não persiste código). Logo, magnitude de edição = quanto o código mudou
 * desde a última EXECUÇÃO, e passos de chat puro pontuam 0 nesse eixo.
 */
export type StepTransition = "fixed" | "regressed" | "changed" | "none";
export type StepMilestone = "firstRun" | "finalCode" | null;

export type StepMeta = {
  /** 1-based; passo i reflete o estado após interactions[i-1]. */
  step: number;
  type: string;
  userPrompt: string;
  /** Tempo desde o passo anterior (ms); null no primeiro evento. */
  deltaMs: number | null;
  addedLines: number;
  removedLines: number;
  transition: StepTransition;
  starred: boolean;
  milestone: StepMilestone;
};

const ERROR_RE = /traceback|errno|exception|invalid syntax|\berror\b/i;

function looksLikeError(s: string | null): boolean {
  return !!s && ERROR_RE.test(s);
}

/** Pausa longa (struggle) e fix de erro são os sinais "fortes" de importância. */
const LONG_PAUSE_MS = 3 * 60 * 1000;
const MIN_STAR_EDIT_LINES = 3;
const MAX_STARS = 5;

export function computeStepMetas(
  interactions: ReplayInteraction[]
): StepMeta[] {
  // Marcos determinísticos: 1.ª execução e último snapshot de código (final).
  let firstRunStep = -1;
  let finalCodeStep = -1;
  interactions.forEach((it, idx) => {
    if (firstRunStep === -1 && it.interactionType === "code_run") {
      firstRunStep = idx + 1;
    }
    if (it.code != null) finalCodeStep = idx + 1;
  });

  let prevCode: string | null = null;
  let prevStdout: string | null = null;
  let prevCreatedMs: number | null = null;

  const editScores: number[] = [];
  const metas: StepMeta[] = interactions.map((it, idx) => {
    const step = idx + 1;
    const createdMs = Date.parse(it.createdAt);
    const deltaMs =
      prevCreatedMs != null && !Number.isNaN(createdMs)
        ? createdMs - prevCreatedMs
        : null;

    let addedLines = 0;
    let removedLines = 0;
    if (it.code != null) {
      const d = lineDiff(prevCode ?? "", it.code);
      addedLines = d.addedCount;
      removedLines = d.removedCount;
    }

    let transition: StepTransition = "none";
    if (it.stdout != null) {
      const errBefore = looksLikeError(prevStdout);
      const errNow = looksLikeError(it.stdout);
      if (errBefore && !errNow) transition = "fixed";
      else if (!errBefore && errNow) transition = "regressed";
      else if (prevStdout != null && prevStdout !== it.stdout)
        transition = "changed";
    }

    editScores.push(addedLines + removedLines);

    const meta: StepMeta = {
      step,
      type: it.interactionType,
      userPrompt: it.userPrompt,
      deltaMs,
      addedLines,
      removedLines,
      transition,
      starred: false,
      milestone:
        step === firstRunStep
          ? "firstRun"
          : step === finalCodeStep
            ? "finalCode"
            : null,
    };

    if (it.code != null) prevCode = it.code;
    if (it.stdout != null) prevStdout = it.stdout;
    if (!Number.isNaN(createdMs)) prevCreatedMs = createdMs;

    return meta;
  });

  // ⭐ = top-k passos com mais edição (mín. 3 linhas) ∪ fix de erro ∪ pausa longa.
  const sortedEdits = editScores.filter((s) => s > 0).sort((a, b) => b - a);
  const k = Math.min(MAX_STARS, Math.max(1, Math.ceil(metas.length * 0.2)));
  const editThreshold = sortedEdits.length
    ? sortedEdits[Math.min(k, sortedEdits.length) - 1]!
    : Infinity;

  metas.forEach((meta, idx) => {
    const editScore = editScores[idx]!;
    const isTopEdit =
      editScore >= MIN_STAR_EDIT_LINES && editScore >= editThreshold;
    const longPause = meta.deltaMs != null && meta.deltaMs >= LONG_PAUSE_MS;
    meta.starred = meta.transition === "fixed" || isTopEdit || longPause;
  });

  return metas;
}
