"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Tutorial id namespace used in localStorage. Keep ids stable — renaming an
 * id will cause the tour to re-fire for everyone who already saw it.
 */
export type TutorialId =
  | "coordinator-onboarding"
  | "classroom-teacher-add"
  | "invite-flow";

const STORAGE_KEY = (id: TutorialId) => `taco-tutorial:${id}`;

export interface UseTutorialOptions {
  /**
   * If true, auto-starts the tour on mount when it hasn't been seen yet.
   * Defaults to false so the caller can control timing (e.g. wait for data
   * to load before highlighting elements).
   */
  autoStart?: boolean;
  /**
   * Localized button labels. Defaults to English.
   */
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  /**
   * Called once the tour completes or is dismissed.
   */
  onFinish?: () => void;
}

/**
 * Hook that wraps Driver.js to run a one-shot guided tour, persisting
 * completion in localStorage so the same user does not see it twice.
 *
 * Returns:
 * - startTour(): force-run the tour (also marks it complete on finish).
 * - resetTour(): clears the localStorage flag so the tour re-fires.
 * - isCompleted: synchronous best-effort read of the storage flag.
 */
export function useTutorial(
  id: TutorialId,
  steps: DriveStep[],
  {
    autoStart = false,
    nextBtnText = "Next",
    prevBtnText = "Back",
    doneBtnText = "Done",
    onFinish,
  }: UseTutorialOptions = {}
) {
  const startedRef = useRef(false);

  const isCompleted = useCallback(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY(id)) === "1";
  }, [id]);

  const markComplete = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY(id), "1");
    onFinish?.();
  }, [id, onFinish]);

  const startTour = useCallback(() => {
    if (typeof window === "undefined") return;
    if (steps.length === 0) return;

    const d = driver({
      showProgress: true,
      allowClose: true,
      animate: true,
      nextBtnText,
      prevBtnText,
      doneBtnText,
      steps,
      onDestroyed: () => {
        markComplete();
      },
    });
    d.drive();
  }, [steps, nextBtnText, prevBtnText, doneBtnText, markComplete]);

  const resetTour = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY(id));
  }, [id]);

  useEffect(() => {
    if (!autoStart) return;
    if (startedRef.current) return;
    if (isCompleted()) return;
    // Defer so the highlighted elements have a chance to mount.
    const timer = window.setTimeout(() => {
      startedRef.current = true;
      startTour();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [autoStart, isCompleted, startTour]);

  return { startTour, resetTour, isCompleted };
}
