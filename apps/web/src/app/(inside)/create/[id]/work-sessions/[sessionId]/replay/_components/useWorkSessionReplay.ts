import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveReplayState,
  type ReplayInteraction,
} from "./deriveReplayState";

/** Intervalo entre passos em play (~2s). */
export const REPLAY_STEP_INTERVAL_MS = 2000;

export type StepDirection = "forward" | "backward" | "none";

export function useWorkSessionReplay(interactions: ReplayInteraction[]) {
  const totalSteps = interactions.length;
  const maxStepIndex = totalSteps;

  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  /** Evita reset ao re-render; só muda quando o conjunto de interações (ids) muda. */
  const interactionsSignatureRef = useRef<string>("");

  useEffect(() => {
    const sig = interactions.map((i) => i.id).join("|");
    if (sig === interactionsSignatureRef.current) return;
    interactionsSignatureRef.current = sig;
    setStepIndex(interactions.length > 0 ? 1 : 0);
    setIsPlaying(false);
  }, [interactions]);

  const effectiveStepIndex = Math.min(stepIndex, maxStepIndex);

  useEffect(() => {
    if (stepIndex !== effectiveStepIndex) {
      setStepIndex(effectiveStepIndex);
    }
  }, [stepIndex, effectiveStepIndex]);

  const prevStepIndexRef = useRef(0);
  const [stepDirection, setStepDirection] = useState<StepDirection>("none");

  useEffect(() => {
    const prev = prevStepIndexRef.current;
    if (effectiveStepIndex > prev) setStepDirection("forward");
    else if (effectiveStepIndex < prev) setStepDirection("backward");
    else setStepDirection("none");
    prevStepIndexRef.current = effectiveStepIndex;
  }, [effectiveStepIndex]);

  const derived = useMemo(
    () => deriveReplayState(interactions, effectiveStepIndex),
    [interactions, effectiveStepIndex]
  );

  const goStart = useCallback(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, []);

  const goEnd = useCallback(() => {
    setStepIndex(maxStepIndex);
    setIsPlaying(false);
  }, [maxStepIndex]);

  const stepPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, Math.min(i, maxStepIndex) - 1));
    setIsPlaying(false);
  }, [maxStepIndex]);

  const stepNext = useCallback(() => {
    setStepIndex((i) => Math.min(maxStepIndex, Math.min(i, maxStepIndex) + 1));
  }, [maxStepIndex]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    if (effectiveStepIndex >= maxStepIndex) {
      setIsPlaying(false);
      return;
    }

    const id = window.setInterval(() => {
      setStepIndex((i) => {
        const cur = Math.min(i, maxStepIndex);
        if (cur >= maxStepIndex) {
          setIsPlaying(false);
          return cur;
        }
        const next = cur + 1;
        if (next >= maxStepIndex) {
          setIsPlaying(false);
        }
        return next;
      });
    }, REPLAY_STEP_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isPlaying, effectiveStepIndex, maxStepIndex]);

  return {
    stepIndex: effectiveStepIndex,
    totalSteps,
    maxStepIndex,
    isPlaying,
    animationsEnabled,
    setAnimationsEnabled,
    stepDirection,
    derived,
    goStart,
    goEnd,
    stepPrev,
    stepNext,
    togglePlay,
    canPrev: effectiveStepIndex > 0,
    canNext: effectiveStepIndex < maxStepIndex,
    canPlay: maxStepIndex > 0 && effectiveStepIndex < maxStepIndex,
  };
}
