"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Eye,
  Loader2,
  MoreHorizontal,
  RotateCw,
  Search,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useGetV1Users } from "@/kubb/hooks/usersHooks/useGetV1Users";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { Pager } from "@/components/admin/pager";
import { AvatarSquare } from "@/components/admin/avatar-square";
import { RoleBadge, isAdminRole } from "@/components/admin/role-badge";
import { AdminToggle } from "@/components/admin/admin-toggle";
import {
  ToggleAdminDialog,
  type ToggleAdminTarget,
} from "@/components/admin/toggle-admin-dialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUser } from "@/contexts/UserContext";

const PER_PAGE = 20;

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const c = useTranslations("common");
  const { user: me } = useUser();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [toggleTarget, setToggleTarget] = useState<ToggleAdminTarget | null>(
    null,
  );

  const trimmed = debouncedSearch.trim();
  const queryEnabled = trimmed.length >= 2;

  const params = useMemo(
    () => ({ q: trimmed, page, perPage: PER_PAGE }),
    [trimmed, page],
  );

  const { data, isLoading, isFetching, error, refetch } = useGetV1Users(
    params,
    { query: { enabled: queryEnabled } },
  );

  const rows = data?.data ?? [];
  const pagination = data?.pagination ?? {
    total: 0,
    page: 1,
    perPage: PER_PAGE,
    totalPages: 1,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("users.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t("users.subtitle")}
          {queryEnabled && data ? (
            <> · {t("users.count", { count: pagination.total })}</>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("users.searchPlaceholder")}
            autoFocus
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
              aria-label={t("users.clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!queryEnabled && search.length > 0 && (
          <span className="text-xs text-slate-500">
            {t("users.minChars")}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {t("users.loadError")}{" "}
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
      ) : !queryEnabled ? (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          <EmptyState
            icon={Search}
            title={t("users.empty.start.title")}
            body={t("users.empty.start.body")}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          {!isLoading && rows.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title={t("users.empty.noResults.title")}
              body={t("users.empty.noResults.body", { query: trimmed })}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/60 hover:bg-transparent">
                    <TableHead className="text-slate-400">
                      {t("users.table.user")}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("users.table.organizations")}
                    </TableHead>
                    <TableHead className="text-slate-400">
                      {t("users.table.platformAdmin")}
                    </TableHead>
                    <TableHead className="text-right text-slate-400">
                      {c("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || (isFetching && rows.length === 0)
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow
                          key={`sk-${i}`}
                          className="border-slate-700/60"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-lg bg-slate-800" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-40 bg-slate-800" />
                                <Skeleton className="h-2.5 w-32 bg-slate-800" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-48 bg-slate-800" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-9 bg-slate-800" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-7 w-7 bg-slate-800" />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map((u) => {
                        const isMe = me?.id === u.id;
                        return (
                          <TableRow
                            key={u.id}
                            className="border-slate-700/60 hover:bg-slate-800/30"
                          >
                            <TableCell className="py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <AvatarSquare name={u.name} size="md" />
                                <div className="flex min-w-0 flex-col">
                                  <span className="flex items-center gap-2 truncate text-sm font-medium text-white">
                                    {u.name}
                                    {isMe && (
                                      <span className="rounded-full border border-slate-600/60 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                                        {t("users.you")}
                                      </span>
                                    )}
                                  </span>
                                  <span className="truncate text-xs text-slate-400">
                                    {u.email}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              {u.memberships.length === 0 ? (
                                <span className="text-xs text-slate-500">
                                  {t("users.noOrganizations")}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {u.memberships.map((m) => {
                                    const role = isAdminRole(m.role)
                                      ? m.role
                                      : null;
                                    return (
                                      <span
                                        key={`${u.id}-${m.organizationId}`}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-950/50 px-2 py-0.5 text-[11px]"
                                      >
                                        <span className="text-white">
                                          {m.organizationName}
                                        </span>
                                        {role && <RoleBadge role={role} />}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <AdminToggle
                                checked={u.isPlatformAdmin}
                                onClick={() =>
                                  setToggleTarget({
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    isPlatformAdmin: u.isPlatformAdmin,
                                  })
                                }
                                ariaLabel={t("users.togglePlatformAdmin", {
                                  name: u.name,
                                })}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
                                    aria-label={t("users.actionsFor", {
                                      name: u.name,
                                    })}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="border-slate-700 bg-slate-900 text-white"
                                >
                                  <DropdownMenuItem
                                    disabled
                                    className="text-slate-400"
                                  >
                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                    {t("users.viewProfile")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
              {isFetching && rows.length > 0 && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-700/60 bg-slate-800/30 px-4 py-2 text-[11px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t("users.updating")}
                </div>
              )}
              <Pager
                page={pagination.page}
                perPage={pagination.perPage}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      <ToggleAdminDialog
        open={!!toggleTarget}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null);
        }}
        target={toggleTarget}
        currentUserId={me?.id ?? ""}
      />
    </div>
  );
}
