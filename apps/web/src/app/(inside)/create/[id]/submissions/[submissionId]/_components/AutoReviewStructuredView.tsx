"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "baixa" | "media" | "alta";

export interface AutoReviewProblem {
  tipo: string;
  gravidade: Severity;
  linha?: number | null;
  descricao: string;
}

export interface AutoReviewStructured {
  pontosFortes: string[];
  problemas: AutoReviewProblem[];
  sugestoes: string[];
  avaliacaoGeral: string;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  baixa: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  media: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  alta: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export function AutoReviewStructuredView({
  review,
}: {
  review: AutoReviewStructured;
}) {
  const t = useTranslations("submissions.autoReview");

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-slate-100 text-sm font-semibold mb-1.5">
          {t("sections.overall")}
        </h3>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
          {review.avaliacaoGeral}
        </p>
      </section>

      {review.pontosFortes.length > 0 && (
        <section>
          <h3 className="text-emerald-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {t("sections.strengths")}
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-200">
            {review.pontosFortes.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.problemas.length > 0 && (
        <section>
          <h3 className="text-rose-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {t("sections.problems")}
          </h3>
          <ul className="space-y-2">
            {review.problemas.map((p, idx) => (
              <li
                key={idx}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  SEVERITY_STYLES[p.gravidade]
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1 text-xs uppercase tracking-wide opacity-80">
                  <span className="font-semibold">{p.tipo}</span>
                  <span>·</span>
                  <span>{t(`severity.${p.gravidade}`)}</span>
                  {p.linha != null && (
                    <>
                      <span>·</span>
                      <span>{t("lineLabel", { line: p.linha })}</span>
                    </>
                  )}
                </div>
                <p className="text-slate-100 leading-snug">{p.descricao}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.sugestoes.length > 0 && (
        <section>
          <h3 className="text-amber-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" />
            {t("sections.suggestions")}
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-200">
            {review.sugestoes.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
