"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Mail, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/admin/pager";
import { useGetV1OrganizationsIdInvitations } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdInvitations";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { EmptyState } from "@/components/admin/empty-state";
import { CreateInvitationDialog } from "./_components/create-invitation-dialog";
import { InvitationsTable, type InvitationRow } from "./_components/invitations-table";

const PER_PAGE = 20;

export default function InvitationsTabPage() {
  const t = useTranslations("adminInvitations");
  const c = useTranslations("common");
  const params = useParams<{ id: string }>();
  const orgId = params?.id ?? "";

  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: orgData } = useGetV1OrganizationsId(orgId, {
    query: { enabled: orgId.length > 0 },
  });
  const orgName = orgData?.data?.name ?? t("fallbackOrgName");

  // Kubb-generated type for this query currently exposes only `status`. The
  // backend now also accepts `page` and `perPage`. We extend the param object
  // locally — the underlying apiClient forwards any keys as query string, so
  // pagination works before the next `npm run kubb` regen.
  const queryParams = useMemo(
    () =>
      ({
        status: "pending",
        page,
        perPage: PER_PAGE,
      }) as unknown as Parameters<
        typeof useGetV1OrganizationsIdInvitations
      >[1],
    [page]
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetV1OrganizationsIdInvitations(orgId, queryParams, {
    query: { enabled: orgId.length > 0 },
  });

  const rows = useMemo<InvitationRow[]>(() => {
    return (data?.data ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      inviterName: inv.inviterName,
      inviterEmail: inv.inviterEmail,
    }));
  }, [data]);

  // `pagination` is sent by the backend now; falls back defensively for the
  // brief window before the API redeploy / when older responses cached.
  const pagination = data?.pagination ?? {
    total: rows.length,
    page: 1,
    perPage: PER_PAGE,
    totalPages: 1,
  };

  const showInitialEmpty =
    !isLoading && !error && rows.length === 0 && page === 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-white">
            {t("title")}
          </h2>
          <p className="text-xs text-slate-400">
            {t.rich("description", {
              orgName,
              strong: (chunks) => (
                <strong className="text-white">{chunks}</strong>
              ),
            })}
            {pagination.total > 0 ? (
              <>
                {" "}
                <span className="text-slate-500">
                  {t("totalCount", { count: pagination.total })}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newInvitation")}
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
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
      ) : showInitialEmpty ? (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          <EmptyState
            icon={Mail}
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
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          <InvitationsTable
            organizationId={orgId}
            rows={rows}
            isLoading={isLoading || (isFetching && rows.length === 0)}
          />
          <Pager
            page={pagination.page}
            perPage={pagination.perPage}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <CreateInvitationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={orgId}
      />
    </div>
  );
}
