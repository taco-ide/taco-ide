"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Globe, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { RoleBadge, isAdminRole, type AdminRole } from "@/components/admin/role-badge";
import { useDeleteV1OrganizationsIdEmailDomainsDomainid } from "@/kubb/hooks/organizationsHooks/useDeleteV1OrganizationsIdEmailDomainsDomainid";
import { getV1OrganizationsIdEmailDomainsQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdEmailDomains";

export interface DomainRow {
  id: string;
  domain: string;
  role: string;
  createdAt: string;
}

interface DomainsTableProps {
  organizationId: string;
  rows: DomainRow[];
  isLoading: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

function toAdminRole(role: string): AdminRole {
  return isAdminRole(role) ? role : "student";
}

export function DomainsTable({
  organizationId,
  rows,
  isLoading,
}: DomainsTableProps) {
  const t = useTranslations("adminDomains");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DomainRow | null>(null);

  const deleteMutation = useDeleteV1OrganizationsIdEmailDomainsDomainid({
    mutation: {
      onSuccess: () => {
        toast.success(t("toast.removed", { domain: pendingDelete?.domain ?? "" }));
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdEmailDomainsQueryKey(organizationId),
        });
        setPendingDelete(null);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : t("error.removeFailed"),
        );
      },
    },
  });

  const showEmpty = !isLoading && rows.length === 0;

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700/60 hover:bg-transparent">
            <TableHead className="text-slate-400">
              {t("table.domain")}
            </TableHead>
            <TableHead className="text-slate-400">{t("table.role")}</TableHead>
            <TableHead className="text-slate-400">
              {t("table.addedAt")}
            </TableHead>
            <TableHead className="text-right text-slate-400">
              {c("actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="border-slate-700/60">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded bg-slate-800" />
                    <Skeleton className="h-3 w-40 bg-slate-800" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 bg-slate-800" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-7 w-7 bg-slate-800" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading &&
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-slate-700/60 hover:bg-slate-800/40"
              >
                <TableCell className="py-3">
                  <span className="inline-flex items-center gap-2 font-mono text-sm font-medium text-white">
                    <Globe className="h-4 w-4 text-amber-400" />@{row.domain}
                  </span>
                </TableCell>
                <TableCell>
                  <RoleBadge role={toAdminRole(row.role)} />
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    title={t("actions.removeDomain")}
                    aria-label={t("actions.removeDomainNamed", {
                      domain: row.domain,
                    })}
                    onClick={() => setPendingDelete(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}

          {showEmpty && (
            <TableRow className="border-slate-700/60 hover:bg-transparent">
              <TableCell colSpan={4}>
                <EmptyState
                  icon={Globe}
                  title={t("empty.title")}
                  body={t("empty.body")}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingDelete
                ? t("deleteDialog.description", {
                    domain: pendingDelete.domain,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className={buttonVariants({ variant: "outline-dark" })}
            >
              {c("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                deleteMutation.mutate({
                  id: organizationId,
                  domainId: pendingDelete.id,
                });
              }}
              className="bg-red-500 text-white hover:bg-red-400"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
