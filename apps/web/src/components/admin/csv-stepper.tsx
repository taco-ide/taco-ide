"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type CsvStep = "upload" | "preview" | "result";

interface CsvStepperProps {
  step: CsvStep;
  className?: string;
}

const stepOrder: CsvStep[] = ["upload", "preview", "result"];

export function CsvStepper({ step, className }: CsvStepperProps) {
  const t = useTranslations("adminShared");
  const currentIndex = stepOrder.indexOf(step);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3",
        className,
      )}
    >
      {stepOrder.map((s, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const showBar = index < stepOrder.length - 1;

        return (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  isDone &&
                    "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
                  isActive &&
                    "border-amber-400/60 bg-amber-400/15 text-amber-300",
                  !isDone &&
                    !isActive &&
                    "border-slate-700 bg-slate-800 text-slate-500",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isDone && "text-emerald-300",
                  isActive && "text-white",
                  !isDone && !isActive && "text-slate-500",
                )}
              >
                {t(`stepper.${s}`)}
              </span>
            </div>
            {showBar && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  isDone ? "bg-emerald-500/40" : "bg-slate-700",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
