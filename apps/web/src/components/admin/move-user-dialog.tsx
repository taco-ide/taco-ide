"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getV1OrganizationsQueryKey,
  useGetV1Organizations,
} from "@/kubb/hooks/organizationsHooks/useGetV1Organizations";
import { usePostV1OrganizationsIdMembersUseridMove } from "@/kubb/hooks/organizationsHooks/usePostV1OrganizationsIdMembersUseridMove";
import { getV1OrganizationsIdMembersQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdMembers";
import { getV1OrganizationsIdQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { getV1UsersQueryKey } from "@/kubb/hooks/usersHooks/useGetV1Users";
import { ApiError } from "@/lib/apiClient";
import { AvatarSquare } from "./avatar-square";
import { RoleBadge, isAdminRole } from "./role-badge";
import { RoleSelect } from "./role-select";
import type { AdminRole } from "./role-badge";

export interface MoveUserMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface MoveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MoveUserMember | null;
  currentOrgId: string;
  currentOrgName: string;
}

export function MoveUserDialog({
  open,
  onOpenChange,
  member,
  currentOrgId,
  currentOrgName,
}: MoveUserDialogProps) {
  const queryClient = useQueryClient();
  const [destOrgId, setDestOrgId] = useState("");
  const [role, setRole] = useState<AdminRole>("teacher");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDestOrgId("");
      setRole("teacher");
      setErrorMessage(null);
    }
  }, [open]);

  const { data: orgsData, isLoading: orgsLoading } = useGetV1Organizations(
    { page: 1, perPage: 100, includeInactive: false },
    { query: { enabled: open } },
  );

  const otherOrgs = useMemo(() => {
    const list = orgsData?.data ?? [];
    return list.filter((o) => o.id !== currentOrgId && o.isActive);
  }, [orgsData, currentOrgId]);

  const mutation = usePostV1OrganizationsIdMembersUseridMove({
    mutation: {
      onSuccess: (_res, variables) => {
        toast.success("Usuário movido para a nova organização");
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdMembersQueryKey(currentOrgId),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdMembersQueryKey(
            variables.data.toOrganizationId,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdQueryKey(currentOrgId),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdQueryKey(variables.data.toOrganizationId),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsQueryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: [getV1UsersQueryKey({ q: "" })[0]],
        });
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setErrorMessage(
              "Não foi possível mover: o usuário é o único administrador da organização atual.",
            );
            return;
          }
          if (err.status === 404) {
            setErrorMessage("Organização ou usuário não encontrado.");
            return;
          }
          setErrorMessage(err.message);
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : "Erro ao mover usuário",
        );
      },
    },
  });

  const handleConfirm = () => {
    if (!member || !destOrgId) return;
    setErrorMessage(null);
    mutation.mutate({
      id: currentOrgId,
      userId: member.userId,
      data: { toOrganizationId: destOrgId, newRole: role },
    });
  };

  const memberRole: AdminRole | null = member && isAdminRole(member.role) ? member.role : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover para outra organização</DialogTitle>
          <DialogDescription className="text-slate-400">
            Move o usuário de {currentOrgName} para outra organização ativa.
          </DialogDescription>
        </DialogHeader>

        {member && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
              <AvatarSquare name={member.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {member.name}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {member.email}
                </div>
              </div>
              {memberRole && <RoleBadge role={memberRole} />}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">
                Organização de destino
              </Label>
              <Select
                value={destOrgId}
                onValueChange={setDestOrgId}
                disabled={orgsLoading || otherOrgs.length === 0}
              >
                <SelectTrigger className="border-slate-700 bg-slate-900/60 text-white">
                  <SelectValue
                    placeholder={
                      orgsLoading
                        ? "Carregando organizações…"
                        : otherOrgs.length === 0
                          ? "Sem outras organizações ativas"
                          : "Selecione uma organização…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  {otherOrgs.map((o) => (
                    <SelectItem
                      key={o.id}
                      value={o.id}
                      className="text-white focus:bg-slate-800 focus:text-white"
                    >
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">
                Papel na nova organização
              </Label>
              <RoleSelect value={role} onChange={setRole} />
            </div>

            <div className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">
                  O usuário perderá acesso a {currentOrgName}.
                </p>
                <p className="text-amber-200/80">
                  Matrículas em turmas, submissões e histórico de chat ficam
                  arquivados na organização atual (não são excluídos).
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline-dark"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!destOrgId || mutation.isPending}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            Mover usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
