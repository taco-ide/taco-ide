"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Mail, Send, X } from "lucide-react";
import { toast } from "sonner";
import apiClient, { ApiError } from "@/lib/apiClient";
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

type ExpiresLabel =
  | { kind: "raw"; value: string }
  | { kind: "expired" }
  | { kind: "inMinutes"; count: number }
  | { kind: "inHours"; count: number }
  | { kind: "inDays"; count: number };

function getExpiresLabel(expiresAt: string): ExpiresLabel {
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return { kind: "raw", value: expiresAt };
  const now = Date.now();
  const diffMs = d.getTime() - now;
  if (diffMs <= 0) return { kind: "expired" };
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return { kind: "inMinutes", count: diffMinutes };
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return { kind: "inHours", count: diffHours };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return { kind: "inDays", count: diffDays };
  return { kind: "raw", value: formatDateTime(expiresAt) };
}

export function InvitationsTable({
  organizationId,
  rows,
  isLoading,
}: InvitationsTableProps) {
  const t = useTranslations("adminInvitations");
  const queryClient = useQueryClient();

  function renderExpiresLabel(expiresAt: string): string {
    const label = getExpiresLabel(expiresAt);
    switch (label.kind) {
      case "raw":
        return label.value;
      case "expired":
        return t("expires.expired");
      case "inMinutes":
        return t("expires.inMinutes", { count: label.count });
      case "inHours":
        return t("expires.inHours", { count: label.count });
      case "inDays":
        return t("expires.inDays", { count: label.count });
    }
  }
  const [pendingCancel, setPendingCancel] = useState<InvitationRow | null>(
    null,
  );

  const cancelMutation = useDeleteV1OrganizationsIdInvitationsInvitationid({
    mutation: {
      onSuccess: () => {
        toast.success(
          pendingCancel
            ? t("toast.canceledFor", { email: pendingCancel.email })
            : t("toast.canceled"),
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
          err instanceof Error ? err.message : t("toast.cancelError"),
        );
      },
    },
  });

  // The Kubb hook for POST /v1/organizations/:id/invitations/:invitationId/resend
  // is generated on the next `npm run kubb`. Until then we issue the call
  // directly through the shared apiClient (same wrapper used by Kubb hooks),
  // so credentials, error mapping and base URL are consistent.
  const resendMutation = useMutation<
    { success: true; data: { id: string; status: string; expiresAt: string } },
    Error,
    { invitationId: string; email: string }
  >({
    mutationFn: async ({ invitationId }) => {
      const res = await apiClient<{
        success: true;
        data: { id: string; status: string; expiresAt: string };
      }>({
        method: "POST",
        url: `/v1/organizations/${organizationId}/invitations/${invitationId}/resend`,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(t("toast.resent", { email: variables.email }));
      void queryClient.invalidateQueries({
        queryKey: [getV1OrganizationsIdInvitationsQueryKey(organizationId)[0]],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message || t("toast.resendConflict"));
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        toast.error(t("toast.resendNotFound"));
        void queryClient.invalidateQueries({
          queryKey: [
            getV1OrganizationsIdInvitationsQueryKey(organizationId)[0],
          ],
        });
        return;
      }
      toast.error(
        err instanceof Error ? err.message : t("toast.resendError"),
      );
    },
  });

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700/60 hover:bg-transparent">
            <TableHead className="text-slate-400">
              {t("table.email")}
            </TableHead>
            <TableHead className="text-slate-400">{t("table.role")}</TableHead>
            <TableHead className="text-slate-400">
              {t("table.expires")}
            </TableHead>
            <TableHead className="text-slate-400">
              {t("table.createdAt")}
            </TableHead>
            <TableHead className="text-right text-slate-400">
              {t("table.actions")}
            </TableHead>
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
                  <Skeleton className="ml-auto h-7 w-16 bg-slate-800" />
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
                      {t("invitedBy", {
                        inviter: row.inviterName ?? row.inviterEmail ?? "",
                      })}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <RoleBadge role={toAdminRole(row.role)} />
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {renderExpiresLabel(row.expiresAt)}
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      title={t("actions.resend")}
                      aria-label={t("actions.resendFor", { email: row.email })}
                      disabled={
                        resendMutation.isPending &&
                        resendMutation.variables?.invitationId === row.id
                      }
                      onClick={() =>
                        resendMutation.mutate({
                          invitationId: row.id,
                          email: row.email,
                        })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-300/80 hover:bg-amber-500/10 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resendMutation.isPending &&
                      resendMutation.variables?.invitationId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      title={t("actions.cancel")}
                      aria-label={t("actions.cancelFor", { email: row.email })}
                      onClick={() => setPendingCancel(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
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
            <AlertDialogTitle>{t("cancelDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingCancel
                ? t("cancelDialog.description", { email: pendingCancel.email })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={cancelMutation.isPending}
              className={buttonVariants({ variant: "outline-dark" })}
            >
              {t("cancelDialog.keep")}
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
              {t("cancelDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
