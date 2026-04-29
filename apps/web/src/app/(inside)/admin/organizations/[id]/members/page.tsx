"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  FileSpreadsheet,
  Link2,
  Loader2,
  RotateCw,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGetV1OrganizationsIdMembers } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdMembers";
import { usePutV1OrganizationsIdMembersUserid } from "@/kubb/hooks/organizationsHooks/usePutV1OrganizationsIdMembersUserid";
import { useDeleteV1OrganizationsIdMembersUserid } from "@/kubb/hooks/organizationsHooks/useDeleteV1OrganizationsIdMembersUserid";
import { useGetV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/admin/empty-state";
import { LinkExistingUserDialog } from "@/components/admin/link-existing-user-dialog";
import { MoveUserDialog } from "@/components/admin/move-user-dialog";
import { CsvImportModal } from "@/components/admin/csv-import-modal";
import { isAdminRole } from "@/components/admin/role-badge";
import type { AdminRole } from "@/components/admin/role-badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { MembersTable, type MemberRow } from "./_components/members-table";

type RoleFilter = "all" | AdminRole;

const filterButtons: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "admin", label: "Administradores" },
  { id: "coordinator", label: "Coordenadores" },
  { id: "teacher", label: "Professores" },
  { id: "student", label: "Alunos" },
];

export default function MembersTabPage() {
  const params = useParams<{ id: string }>();
  const orgId = params?.id ?? "";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [linkOpen, setLinkOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MemberRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);

  const { data: orgData } = useGetV1OrganizationsId(orgId, {
    query: { enabled: orgId.length > 0 },
  });
  const orgName = orgData?.data?.name ?? "esta organização";

  const queryParams = useMemo(() => {
    const trimmed = debouncedSearch.trim();
    return {
      ...(trimmed.length > 0 ? { q: trimmed } : {}),
      ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    };
  }, [debouncedSearch, roleFilter]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetV1OrganizationsIdMembers(orgId, queryParams, {
    query: { enabled: orgId.length > 0 },
  });

  const rows = useMemo<MemberRow[]>(() => {
    return (data?.data ?? []).map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: m.createdAt,
      lastActiveAt: m.lastActiveAt,
      joinedVia: m.joinedVia,
    }));
  }, [data]);

  const counts = useMemo(() => {
    const base: Record<RoleFilter, number> = {
      all: rows.length,
      admin: 0,
      coordinator: 0,
      teacher: 0,
      student: 0,
    };
    for (const row of rows) {
      if (isAdminRole(row.role)) {
        base[row.role] += 1;
      }
    }
    return base;
  }, [rows]);

  // Solo-admin guard: backend doesn't paginate this list, so the response
  // contains every member. When exactly one row has role === "admin", that
  // row is locked.
  const adminCountInResponse = counts.admin;
  const isSoloAdmin = (row: MemberRow) =>
    adminCountInResponse === 1 && row.role === "admin";

  const updateRole = usePutV1OrganizationsIdMembersUserid({
    mutation: {
      onSuccess: () => {
        toast.success("Papel atualizado");
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return (
              first?.url === "/v1/organizations/:id/members" ||
              first?.url === "/v1/users/"
            );
          },
        });
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          toast.error(
            "Não foi possível alterar — esta operação deixaria a organização sem administradores.",
          );
          return;
        }
        toast.error(
          err instanceof Error ? err.message : "Erro ao atualizar papel",
        );
      },
    },
  });

  const removeMember = useDeleteV1OrganizationsIdMembersUserid({
    mutation: {
      onSuccess: () => {
        toast.success("Membro removido da organização");
        setRemoveTarget(null);
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return (
              first?.url === "/v1/organizations/:id/members" ||
              first?.url === "/v1/organizations/:id" ||
              first?.url === "/v1/organizations/" ||
              first?.url === "/v1/users/"
            );
          },
        });
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          toast.error(
            "Não é possível remover o único administrador da organização.",
          );
          return;
        }
        toast.error(
          err instanceof Error ? err.message : "Erro ao remover membro",
        );
      },
    },
  });

  const pendingRoleUserId = updateRole.isPending
    ? (updateRole.variables as { userId?: string } | undefined)?.userId
    : undefined;

  const handleRoleChange = (row: MemberRow, role: AdminRole) => {
    if (row.role === role) return;
    updateRole.mutate({ id: orgId, userId: row.userId, data: { role } });
  };

  const handleRemoveConfirm = () => {
    if (!removeTarget) return;
    removeMember.mutate({ id: orgId, userId: removeTarget.userId });
  };

  const showSearchEmpty =
    !isLoading &&
    rows.length === 0 &&
    (debouncedSearch.trim().length > 0 || roleFilter !== "all");

  const showInitialEmpty =
    !isLoading &&
    !error &&
    rows.length === 0 &&
    debouncedSearch.trim().length === 0 &&
    roleFilter === "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar membros por nome ou email…"
            className="bg-slate-900 border-slate-700 pl-9 pr-9 text-white placeholder:text-slate-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-900 p-1">
          {filterButtons.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRoleFilter(opt.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === opt.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {opt.label}{" "}
              <span className="text-slate-500">· {counts[opt.id]}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Adicionar membro
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-slate-700 bg-slate-900 text-white"
            >
              <DropdownMenuItem
                onClick={() => setLinkOpen(true)}
                className="focus:bg-slate-800"
              >
                <Link2 className="mr-2 h-3.5 w-3.5" />
                <div className="flex flex-col items-start">
                  <span className="text-sm">Vincular usuário existente</span>
                  <span className="text-[11px] text-slate-400">
                    Buscar em toda a plataforma
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCsvOpen(true)}
                className="focus:bg-slate-800"
              >
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                <div className="flex flex-col items-start">
                  <span className="text-sm">Importar de CSV</span>
                  <span className="text-[11px] text-slate-400">
                    Adicionar vários de uma vez
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Não foi possível carregar os membros.{" "}
              {error instanceof Error ? error.message : ""}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch();
            }}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          {showInitialEmpty ? (
            <EmptyState
              icon={Users}
              title="Sem membros"
              body="Esta organização ainda não tem membros."
            />
          ) : showSearchEmpty ? (
            <EmptyState
              icon={Users}
              title="Nenhum membro corresponde"
              body="Tente uma busca ou filtro de papel diferente."
            />
          ) : (
            <>
              <MembersTable
                rows={rows}
                isLoading={isLoading || (isFetching && rows.length === 0)}
                isSoloAdmin={isSoloAdmin}
                pendingRoleUserId={pendingRoleUserId}
                onRoleChange={handleRoleChange}
                onMove={setMoveTarget}
                onRemove={setRemoveTarget}
              />
              {isFetching && rows.length > 0 && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-700/60 bg-slate-800/30 px-4 py-2 text-[11px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> atualizando…
                </div>
              )}
            </>
          )}
        </div>
      )}

      <LinkExistingUserDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        organizationId={orgId}
      />

      <MoveUserDialog
        open={!!moveTarget}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        member={
          moveTarget
            ? {
                userId: moveTarget.userId,
                name: moveTarget.name,
                email: moveTarget.email,
                role: moveTarget.role,
              }
            : null
        }
        currentOrgId={orgId}
        currentOrgName={orgName}
      />

      <CsvImportModal
        open={csvOpen}
        onOpenChange={setCsvOpen}
        organizationId={orgId}
      />

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover desta organização?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {removeTarget
                ? `${removeTarget.name} (${removeTarget.email}) perderá acesso a ${orgName}. Esta ação pode ser revertida vinculando o usuário novamente.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={removeMember.isPending}
              className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={removeMember.isPending}
              className="bg-rose-500 text-white hover:bg-rose-400"
            >
              {removeMember.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
