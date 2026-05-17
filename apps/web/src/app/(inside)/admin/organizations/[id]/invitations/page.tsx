"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Mail, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetV1OrganizationsIdInvitations } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdInvitations";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { EmptyState } from "@/components/admin/empty-state";
import { CreateInvitationDialog } from "./_components/create-invitation-dialog";
import { InvitationsTable, type InvitationRow } from "./_components/invitations-table";

export default function InvitationsTabPage() {
  const params = useParams<{ id: string }>();
  const orgId = params?.id ?? "";

  const [createOpen, setCreateOpen] = useState(false);

  const { data: orgData } = useGetV1OrganizationsId(orgId, {
    query: { enabled: orgId.length > 0 },
  });
  const orgName = orgData?.data?.name ?? "esta organização";

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetV1OrganizationsIdInvitations(
    orgId,
    { status: "pending" },
    { query: { enabled: orgId.length > 0 } },
  );

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

  const showInitialEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-white">
            Convites pendentes
          </h2>
          <p className="text-xs text-slate-400">
            Convites enviados para entrar em{" "}
            <strong className="text-white">{orgName}</strong> que ainda não
            foram aceitos.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novo convite
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Não foi possível carregar os convites.{" "}
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
            Tentar novamente
          </Button>
        </div>
      ) : showInitialEmpty ? (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          <EmptyState
            icon={Mail}
            title="Nenhum convite pendente"
            body="Envie um convite por email para que um novo membro entre nesta organização."
            action={
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Criar primeiro convite
              </Button>
            }
          />
        </div>
      ) : (
        <InvitationsTable
          organizationId={orgId}
          rows={rows}
          isLoading={isLoading || (isFetching && rows.length === 0)}
        />
      )}

      <CreateInvitationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={orgId}
      />
    </div>
  );
}
