"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { useTranslations } from "next-intl";
type ReplayToolbarProps = {
  stepIndex: number;
  totalInteractions: number;
  isPlaying: boolean;
  animationsEnabled: boolean;
  onAnimationsEnabledChange: (value: boolean) => void;
  canPrev: boolean;
  canNext: boolean;
  canPlay: boolean;
  onGoStart: () => void;
  onGoEnd: () => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onTogglePlay: () => void;
  lastInteractionAt: string | null;
};

function formatStepTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return "—";
  }
}

export function ReplayToolbar({
  stepIndex,
  totalInteractions,
  isPlaying,
  animationsEnabled,
  onAnimationsEnabledChange,
  canPrev,
  canNext,
  canPlay,
  onGoStart,
  onGoEnd,
  onStepPrev,
  onStepNext,
  onTogglePlay,
  lastInteractionAt,
}: ReplayToolbarProps) {
  const t = useTranslations("workSessions");
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-900 text-slate-200"
          onClick={onGoStart}
          disabled={!canPrev}
          aria-label={t("replay.toolbar.goStart")}
        >
          <ArrowLeftToLine className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-900 text-slate-200"
          onClick={onStepPrev}
          disabled={!canPrev}
          aria-label={t("replay.toolbar.stepPrev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-amber-500/90 text-slate-900 hover:bg-amber-500 min-w-[100px]"
          onClick={onTogglePlay}
          disabled={!canPlay && !isPlaying}
          aria-label={
            isPlaying ? t("replay.toolbar.pauseAria") : t("replay.toolbar.playAria")
          }
        >
          {isPlaying ? (
            <>
              <Pause className="mr-2 h-4 w-4" />
              {t("replay.toolbar.pause")}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {t("replay.toolbar.play")}
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-900 text-slate-200"
          onClick={onStepNext}
          disabled={!canNext}
          aria-label={t("replay.toolbar.stepNext")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-900 text-slate-200"
          onClick={onGoEnd}
          disabled={!canNext}
          aria-label={t("replay.toolbar.goEnd")}
        >
          <ArrowRightToLine className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="text-sm text-slate-400">
          <span className="font-medium text-slate-300">{t("replay.toolbar.stepLabel")}</span>{" "}
          {stepIndex} / {totalInteractions}
          {stepIndex === 0 && totalInteractions > 0 ? (
            <span className="ml-1 text-slate-500">
              {t("replay.toolbar.beforeFirstEvent")}
            </span>
          ) : null}
          <span className="mx-2 text-slate-600">·</span>
          <span className="font-medium text-slate-300">{t("replay.toolbar.lastEventLabel")}</span>{" "}
          {formatStepTime(lastInteractionAt)}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="replay-no-animations"
            type="checkbox"
            checked={!animationsEnabled}
            onChange={(e) => onAnimationsEnabledChange(!e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
          />
          <Label
            htmlFor="replay-no-animations"
            className="cursor-pointer text-slate-200 text-sm"
          >
            {t("replay.toolbar.noAnimations")}
          </Label>
        </div>
      </div>
    </div>
  );
}
