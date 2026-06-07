"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PagerProps {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function buildPageList(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const add = (p: number | "ellipsis") => pages.push(p);

  add(1);
  if (current > 4) add("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let p = start; p <= end; p++) add(p);

  if (current < totalPages - 3) add("ellipsis");
  add(totalPages);

  return pages;
}

export function Pager({ page, perPage, total, totalPages, onPageChange }: PagerProps) {
  const t = useTranslations("adminShared");
  if (total === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const pages = buildPageList(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-700/60 bg-slate-800/30 px-4 py-3 text-xs text-slate-400">
      <div>
        {t.rich("pager.showing", {
          range: `${start}–${end}`,
          total,
          strong: (chunks) => <strong className="text-white">{chunks}</strong>,
        })}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/60 text-slate-300 hover:bg-slate-700/40 disabled:opacity-40",
          )}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t("pager.previousPage")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-slate-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cn(
                "flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-medium",
                p === page
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-700/60 text-slate-300 hover:bg-slate-700/40",
              )}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/60 text-slate-300 hover:bg-slate-700/40 disabled:opacity-40",
          )}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label={t("pager.nextPage")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
