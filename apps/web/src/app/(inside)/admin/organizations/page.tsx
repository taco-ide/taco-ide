"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGetV1Organizations } from "@/kubb/hooks/organizationsHooks/useGetV1Organizations";
import { usePatchV1OrganizationsIdActive } from "@/kubb/hooks/organizationsHooks/usePatchV1OrganizationsIdActive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/admin/empty-state";
import { Pager } from "@/components/admin/pager";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { CreateOrganizationDialog } from "./_components/create-organization-dialog";
import { EditOrganizationDialog } from "./_components/edit-organization-dialog";
import {
  OrganizationsTable,
  type OrganizationRow,
} from "./_components/organizations-table";

type FilterMode = "all" | "active" | "inactive";

const PER_PAGE = 20;

export default function OrganizationsPage() {
  const t = useTranslations("adminOrgs");
  const c = useTranslations("common");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrganizationRow | null>(null);

  // Filter is handled server-side via `includeInactive`:
  // - "active":   includeInactive=false (default) → only active rows
  // - "all":      includeInactive=true            → active + inactive rows
  // - "inactive": includeInactive=true + client-side filter on the page
  //   (the API has no "inactive only" parameter today; pagination is hidden
  //   in this mode to avoid misleading totals — see hidePager below.)
  const includeInactive = filter !== "active";

  const params = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      ...(debouncedSearch.trim().length > 0
        ? { q: debouncedSearch.trim() }
        : {}),
      includeInactive,
    }),
    [page, debouncedSearch, includeInactive],
  );

  const { data, isLoading, isFetching, error, refetch } =
    useGetV1Organizations(params);

  const fetchedRows: OrganizationRow[] = data?.data ?? [];
  const rows = useMemo(() => {
    if (filter === "inactive") return fetchedRows.filter((o) => !o.isActive);
    return fetchedRows;
  }, [fetchedRows, filter]);

  const pagination = data?.pagination ?? {
    total: 0,
    page: 1,
    perPage: PER_PAGE,
    totalPages: 1,
  };

  // When "Inativas" is selected, the count of items returned reflects the
  // current page only (because filtering is post-fetch). Hiding the pager
  // avoids showing wrong page counts. "Todas" / "Ativas" use server-side
  // filters, so pagination is reliable.
  const hidePager = filter === "inactive";

  const toggleActive = usePatchV1OrganizationsIdActive({
    mutation: {
      onSuccess: (_res, vars) => {
        toast.success(t("toast.statusUpdated"));
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return (
              first?.url === "/v1/organizations/" ||
              first?.url === "/v1/organizations/:id"
            );
          },
        });
        // Touch the variable to keep it referenced for ts-strict noUnusedParameters compatibility.
        void vars;
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : t("toast.statusUpdateError"),
        );
      },
    },
  });

  const handleToggleActive = (org: OrganizationRow) => {
    toggleActive.mutate({ id: org.id, data: { isActive: !org.isActive } });
  };

  const showInitialEmpty =
    !isLoading &&
    !error &&
    rows.length === 0 &&
    !debouncedSearch &&
    filter === "all";

  // Header summary uses `pagination.total`, which respects server-side
  // filters (search + includeInactive). For "Inativas" we cannot compute a
  // global count without API support; fall back to "X nesta página".
  const summaryText = (() => {
    if (filter === "inactive") {
      return t("summary.inactiveOnPage", { count: rows.length });
    }
    if (filter === "active") {
      return t("summary.active", { count: pagination.total });
    }
    return t("summary.total", { count: pagination.total });
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{summaryText}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newOrganization")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="bg-slate-900 border-slate-700 pl-9 pr-9 text-white placeholder:text-slate-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
              aria-label={t("clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 p-1">
          {(
            [
              { id: "all", label: t("filter.all") },
              { id: "active", label: t("filter.active") },
              { id: "inactive", label: t("filter.inactive") },
            ] as { id: FilterMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setFilter(opt.id);
                setPage(1);
              }}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === opt.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {t("loadError")}{" "}
              {error instanceof Error ? error.message : ""}
            </span>
          </div>
          <Button
            type="button"
            variant="outline-dark"
            size="sm"
            onClick={() => {
              void refetch();
            }}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            {c("retry")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          {showInitialEmpty ? (
            <EmptyState
              icon={Building2}
              title={t("empty.title")}
              body={t("empty.body")}
              action={
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("empty.action")}
                </Button>
              }
            />
          ) : !isLoading && rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={t("noResults.title")}
              body={
                debouncedSearch
                  ? t("noResults.bodyWithQuery", { query: debouncedSearch })
                  : t("noResults.bodyNoQuery")
              }
            />
          ) : (
            <>
              <OrganizationsTable
                rows={rows}
                isLoading={isLoading || (isFetching && rows.length === 0)}
                onEdit={(org) => setEditOrg(org)}
                onToggleActive={handleToggleActive}
                togglingId={
                  toggleActive.isPending
                    ? (toggleActive.variables as { id?: string } | undefined)
                        ?.id
                    : undefined
                }
              />
              {!hidePager && (
                <Pager
                  page={pagination.page}
                  perPage={pagination.perPage}
                  total={pagination.total}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      )}

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditOrganizationDialog
        open={!!editOrg}
        onOpenChange={(open) => {
          if (!open) setEditOrg(null);
        }}
        org={editOrg}
      />
    </div>
  );
}
