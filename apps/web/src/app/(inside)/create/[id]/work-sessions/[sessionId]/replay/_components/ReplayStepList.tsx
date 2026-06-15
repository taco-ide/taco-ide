"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  ListOrdered,
  MessageSquare,
  Play,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { StepMeta } from "./deriveStepMeta";

function formatDelta(ms: number | null): string | null {
  if (ms == null || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `+${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `+${m}min`;
  const h = Math.floor(m / 60);
  return `+${h}h${String(m % 60).padStart(2, "0")}`;
}

function truncate(text: string, max = 64): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type ReplayStepListProps = {
  metas: StepMeta[];
  currentStep: number;
  onSelect: (step: number) => void;
};

export function ReplayStepList({
  metas,
  currentStep,
  onSelect,
}: ReplayStepListProps) {
  const t = useTranslations("workSessions");
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentStep]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-slate-700 bg-slate-800/40 text-slate-100 shadow-none">
      <CardHeader className="shrink-0 space-y-0 border-b border-slate-700/80 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <ListOrdered className="h-4 w-4 text-amber-500/90" />
          {t("replay.steps.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
        <ol className="space-y-1">
          {metas.map((m) => {
            const isActive = m.step === currentStep;
            const isRun = m.type === "code_run";
            const delta = formatDelta(m.deltaMs);
            const summary = isRun
              ? t("replay.steps.run")
              : truncate(m.userPrompt) || t("replay.steps.chatFallback");
            const hasMetaRow =
              m.addedLines > 0 ||
              m.removedLines > 0 ||
              m.transition === "fixed" ||
              m.transition === "regressed" ||
              !!m.milestone ||
              !!delta;

            return (
              <li key={m.step}>
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(m.step)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                    isActive
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-transparent hover:border-slate-600 hover:bg-slate-800/60"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 font-mono text-[10px] text-slate-500">
                      {m.step}
                    </span>
                    {isRun ? (
                      <Play className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                      {summary}
                    </span>
                    {m.starred ? (
                      <Star
                        className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                        aria-label={t("replay.steps.important")}
                      />
                    ) : null}
                  </div>

                  {hasMetaRow ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-7 text-[10px]">
                      {m.addedLines > 0 || m.removedLines > 0 ? (
                        <span className="font-mono">
                          {m.addedLines > 0 ? (
                            <span className="text-emerald-400">
                              +{m.addedLines}
                            </span>
                          ) : null}
                          {m.removedLines > 0 ? (
                            <span className="ml-1 text-rose-400">
                              −{m.removedLines}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {m.transition === "fixed" ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("replay.steps.fixed")}
                        </span>
                      ) : null}
                      {m.transition === "regressed" ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-400">
                          <AlertTriangle className="h-3 w-3" />
                          {t("replay.steps.broke")}
                        </span>
                      ) : null}
                      {m.milestone === "firstRun" ? (
                        <span className="inline-flex items-center gap-0.5 text-sky-400">
                          <Flag className="h-3 w-3" />
                          {t("replay.steps.firstRun")}
                        </span>
                      ) : null}
                      {m.milestone === "finalCode" ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <Flag className="h-3 w-3" />
                          {t("replay.steps.finalCode")}
                        </span>
                      ) : null}
                      {delta ? (
                        <span className="ml-auto text-slate-500">{delta}</span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
