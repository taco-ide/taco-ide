"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, X } from "lucide-react";
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
import { RoleBadge, isAdminRole } from "@/components/admin/role-badge";
import type { AdminRole } from "@/components/admin/role-badge";
import { useDeleteV1OrganizationsIdInvitationsInvitationid } from "@/kubb/hooks/organizationsHooks/useDeleteV1OrganizationsIdInvitationsInvitationid";
import { getV1OrganizationsIdInvitationsQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdInvitations";

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviterName: string | null;
  inviterEmail: string | null;
}

interface InvitationsTableProps {
  organizationId: string;
  rows: InvitationRow[];
  isLoading: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

function toAdminRole(role: string): AdminRole {
  return isAdminRole(role) ? role : "student";
}

function expiresInLabel(expiresAt: string): string {
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  if (diffMs <= 0) return "Expirado";
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `em ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `em ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `em ${diffDays} d`;
  return formatDateTime(expiresAt);
}

export function InvitationsTable({
  organizationId,
  rows,
  isLoading,
}: InvitationsTableProps) {
  const queryClient = useQueryClient();
  const [pendingCancel, setPendingCancel] = useState<InvitationRow | null>(
    null,
  );

  const cancelMutation = useDeleteV1OrganizationsIdInvitationsInvitationid({
    mutation: {
      onSuccess: () => {
        toast.success(
          pendingCancel
            ? `Convite para "${pendingCancel.email}" cancelado`
            : "Convite cancelado",
        );
        // Invalidate without the params discriminator so any status filter
        // (currently only "pending" is rendered, but the key matches loosely)
        // gets refetched.
        void queryClient.invalidateQueries({
          queryKey: [getV1OrganizationsIdInvitationsQueryKey(organizationId)[0]],
        });
        setPendingCancel(null);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Erro ao cancelar convite",
        );
      },
    },
  });

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700/60 hover:bg-transparent">
            <TableHead className="text-slate-400">Email</TableHead>
            <TableHead className="text-slate-400">Papel</TableHead>
            <TableHead className="text-slate-400">Expira</TableHead>
            <TableHead className="text-slate-400">Criado em</TableHead>
            <TableHead className="text-right text-slate-400">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="border-slate-700/60">
                <TableCell>
                  <Skeleton className="h-4 w-48 bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28 bg-slate-800" />
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
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                    <Mail className="h-4 w-4 text-amber-400" />
                    {row.email}
                  </span>
                  {row.inviterName || row.inviterEmail ? (
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      convidado por{" "}
                      {row.inviterName ?? row.inviterEmail}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <RoleBadge role={toAdminRole(row.role)} />
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {expiresInLabel(row.expiresAt)}
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    title="Cancelar convite"
                    aria-label={`Cancelar convite de ${row.email}`}
                    onClick={() => setPendingCancel(row)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingCancel
                ? `O convite para "${pendingCancel.email}" será cancelado e o link enviado deixará de funcionar. Você poderá enviar um novo convite depois.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={cancelMutation.isPending}
              className={buttonVariants({ variant: "outline-dark" })}
            >
              Manter convite
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingCancel) return;
                cancelMutation.mutate({
                  id: organizationId,
                  invitationId: pendingCancel.id,
                });
              }}
              className="bg-red-500 text-white hover:bg-red-400"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
