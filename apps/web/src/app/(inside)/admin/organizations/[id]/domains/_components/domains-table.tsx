"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { RoleBadge } from "@/components/admin/role-badge";
import type { AdminRole } from "@/components/admin/role-badge";
import { isAdminRole } from "@/components/admin/role-badge";
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
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DomainRow | null>(null);

  const deleteMutation = useDeleteV1OrganizationsIdEmailDomainsDomainid({
    mutation: {
      onSuccess: () => {
        toast.success(`Domínio "${pendingDelete?.domain}" removido`);
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdEmailDomainsQueryKey(organizationId),
        });
        setPendingDelete(null);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Erro ao remover domínio",
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
            <TableHead className="text-slate-400">Domínio</TableHead>
            <TableHead className="text-slate-400">Papel</TableHead>
            <TableHead className="text-slate-400">Adicionado em</TableHead>
            <TableHead className="text-right text-slate-400">Ações</TableHead>
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
                    title="Remover domínio"
                    aria-label={`Remover domínio ${row.domain}`}
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
                  title="Nenhum domínio configurado"
                  body="Adicione um domínio acima para habilitar o vínculo automático para emails correspondentes."
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
            <AlertDialogTitle>Remover domínio?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingDelete
                ? `O domínio "@${pendingDelete.domain}" deixará de vincular automaticamente novos usuários a esta organização. Membros já criados não serão afetados.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
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
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
