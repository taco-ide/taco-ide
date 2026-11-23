"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetV1OrganizationsIdTeachingAssistantEvaluationsStats } from "@/kubb/hooks";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ALL = "__all__";

type Filters = { teachingAssistantId?: string; from?: string; to?: string };

function toQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type Group = { count: number | null; mean: number | null; suppressed: boolean };

function formatMean(mean: number | null): string {
  return mean === null ? "—" : mean.toFixed(2);
}

/** Count with a * when some ratings were withheld (small-cell suppression). */
function formatGroupCount(group: Group, withheld: string): string {
  if (group.count === null) return withheld;
  return group.suppressed ? `${group.count}*` : String(group.count);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function DistributionChart({
  distribution,
  total,
}: {
  distribution: { grade: number; count: number }[];
  total: number;
}) {
  const t = useTranslations("taRatings");
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {t("distribution.title")}
      </h2>
      <ul className="space-y-2" aria-label={t("distribution.title")}>
        {[...distribution].reverse().map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <li key={d.grade} className="flex items-center gap-3 text-sm">
              <span className="flex w-10 shrink-0 items-center gap-1 text-slate-300">
                {d.grade}
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-slate-700/40">
                <div
                  className="h-full rounded bg-amber-400/80"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums text-slate-300">
                {t("distribution.count", { count: d.count, pct })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WeeklyChart({
  weekly,
  minGroupSize,
}: {
  weekly: ({ week: string } & Group)[];
  minGroupSize: number;
}) {
  const t = useTranslations("taRatings");
  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {t("weekly.title")}
      </h2>
      <p className="mb-4 text-xs text-slate-500">{t("weekly.subtitle")}</p>
      <div className="overflow-x-auto">
        <div className="flex h-48 min-w-fit items-end gap-2">
          {weekly.map((w) => {
            const withheld = w.count === null;
            const title = withheld
              ? t("suppressed.weekTooltip", { week: w.week, k: minGroupSize })
              : w.mean === null
                ? t("weekly.emptyTooltip", { week: w.week })
                : t("weekly.tooltip", {
                    week: w.week,
                    mean: w.mean.toFixed(2),
                    count: w.count ?? 0,
                  });
            return (
              <div
                key={w.week}
                className="flex w-12 shrink-0 flex-col items-center gap-1"
                title={title}
                data-suppressed={withheld ? "true" : undefined}
              >
                <span className="text-xs tabular-nums text-slate-300">
                  {w.mean === null ? "—" : w.mean.toFixed(1)}
                </span>
                <div className="flex h-32 w-8 items-end rounded bg-slate-700/40">
                  {withheld ? (
                    <div className="h-full w-full rounded bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.25)_0_4px,transparent_4px_8px)]" />
                  ) : w.mean !== null ? (
                    <div
                      className="w-full rounded bg-sky-400/80"
                      style={{ height: `${(w.mean / 5) * 100}%` }}
                    />
                  ) : null}
                </div>
                <span className="text-[10px] tabular-nums text-slate-500">
                  {w.week.slice(5)}
                </span>
                <span className="text-[10px] tabular-nums text-slate-500">
                  {withheld
                    ? `n<${minGroupSize}`
                    : `n=${formatGroupCount(w, "")}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TaRatingsPanel({ organizationId }: { organizationId: string }) {
  const t = useTranslations("taRatings");
  const [filters, setFilters] = useState<Filters>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const invalidRange =
    !!filters.from && !!filters.to && filters.from > filters.to;

  // Keep the previous result on screen while new filters load, so the TA
  // dropdown and table don't vanish mid-refetch.
  const { data, isLoading, isPlaceholderData, error } =
    useGetV1OrganizationsIdTeachingAssistantEvaluationsStats(
      organizationId,
      filters,
      { query: { enabled: !invalidRange, placeholderData: keepPreviousData } }
    );
  const stats = data?.data;
  const anySuppressed =
    !!stats &&
    (stats.suppressed ||
      stats.weekly.some((w) => w.suppressed) ||
      stats.teachingAssistants.some((ta) => ta.suppressed));

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const res = await fetch(
        `${API_BASE_URL}/v1/organizations/${organizationId}/teaching-assistant-evaluations/export${toQuery(filters)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ta-ratings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div className="min-w-48 space-y-1.5">
          <Label className="text-xs text-slate-400">{t("filters.assistant")}</Label>
          <Select
            value={filters.teachingAssistantId ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                teachingAssistantId: v === ALL ? undefined : v,
              }))
            }
          >
            <SelectTrigger className="border-slate-600 bg-slate-900/60 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allAssistants")}</SelectItem>
              {(stats?.teachingAssistants ?? []).map((ta) => (
                <SelectItem key={ta.id} value={ta.id}>
                  {ta.alias} v{ta.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ta-ratings-from" className="text-xs text-slate-400">
            {t("filters.from")}
          </Label>
          <Input
            id="ta-ratings-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value || undefined }))
            }
            className="border-slate-600 bg-slate-900/60 text-slate-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ta-ratings-to" className="text-xs text-slate-400">
            {t("filters.to")}
          </Label>
          <Input
            id="ta-ratings-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value || undefined }))
            }
            className="border-slate-600 bg-slate-900/60 text-slate-200"
          />
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="outline"
            className="border-slate-600 bg-slate-800/80 text-slate-200"
            onClick={handleExport}
            disabled={exporting || invalidRange}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            {t("export.button")}
          </Button>
          {exportError ? (
            <span className="text-xs text-red-400">{t("export.error")}</span>
          ) : null}
        </div>
      </section>

      {invalidRange ? (
        <p className="text-sm text-red-400">{t("filters.invalidRange")}</p>
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      ) : error || !stats ? (
        <p className="text-sm text-red-400">{t("loadError")}</p>
      ) : stats.total === 0 && !stats.suppressed ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center text-sm text-slate-400">
          {t("empty")}
        </div>
      ) : (
        <div
          className={`space-y-6 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}
          aria-busy={isPlaceholderData}
        >
          {anySuppressed ? (
            <p
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
              data-testid="ta-ratings-suppressed-note"
            >
              {stats.total === null
                ? t("suppressed.allNote", { k: stats.minGroupSize })
                : t("suppressed.partialNote", { k: stats.minGroupSize })}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile
              label={t("stats.total")}
              value={formatGroupCount(
                { count: stats.total, mean: stats.mean, suppressed: stats.suppressed },
                t("suppressed.value")
              )}
            />
            <StatTile
              label={t("stats.mean")}
              value={
                stats.total === null ? t("suppressed.value") : formatMean(stats.mean)
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {stats.distribution && stats.total ? (
              <DistributionChart
                distribution={stats.distribution}
                total={stats.total}
              />
            ) : null}
            <WeeklyChart weekly={stats.weekly} minGroupSize={stats.minGroupSize} />
          </div>
        </div>
      )}

      {stats && stats.teachingAssistants.length > 0 ? (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t("byAssistant.title")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 font-medium">{t("byAssistant.assistant")}</th>
                <th className="py-2 text-right font-medium">{t("stats.total")}</th>
                <th className="py-2 text-right font-medium">{t("stats.mean")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.teachingAssistants.map((ta) => (
                <tr key={ta.id} className="border-t border-slate-700/60">
                  <td className="py-2 text-slate-200">
                    {ta.alias} v{ta.version}
                    {!ta.isActive ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {t("byAssistant.inactive")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-300">
                    {formatGroupCount(ta, t("suppressed.value"))}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-300">
                    {ta.count === null ? t("suppressed.value") : formatMean(ta.mean)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <p className="text-xs text-slate-500">{t("privacyNote")}</p>
    </div>
  );
}
