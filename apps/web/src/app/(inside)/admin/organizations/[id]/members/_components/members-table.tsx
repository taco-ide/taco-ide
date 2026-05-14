"use client";

import {
  ArrowRightLeft,
  Eye,
  Globe,
  Lock,
  Mail,
  MoreHorizontal,
  UserMinus,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserCell } from "@/components/admin/user-cell";
import { RoleSelect } from "@/components/admin/role-select";
import { isAdminRole } from "@/components/admin/role-badge";
import type { AdminRole } from "@/components/admin/role-badge";
import { formatRelativeTimePtBR } from "@/lib/relative-time";

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastActiveAt: string | null;
  joinedVia: "domain" | "manual" | "invitation";
}

interface MembersTableProps {
  rows: MemberRow[];
  isLoading: boolean;
  isSoloAdmin: (row: MemberRow) => boolean;
  pendingRoleUserId: string | undefined;
  onRoleChange: (row: MemberRow, role: AdminRole) => void;
  onMove: (row: MemberRow) => void;
  onRemove: (row: MemberRow) => void;
}

const joinedViaLabel: Record<MemberRow["joinedVia"], string> = {
  domain: "Domínio",
  manual: "Manual",
  invitation: "Convite",
};

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : email;
}

export function MembersTable({
  rows,
  isLoading,
  isSoloAdmin,
  pendingRoleUserId,
  onRoleChange,
  onMove,
  onRemove,
}: MembersTableProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700/60 hover:bg-transparent">
            <TableHead className="text-slate-400">Membro</TableHead>
            <TableHead className="text-slate-400">Papel</TableHead>
            <TableHead className="text-slate-400">Última atividade</TableHead>
            <TableHead className="text-slate-400">Origem</TableHead>
            <TableHead className="text-right text-slate-400">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="border-slate-700/60">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg bg-slate-800" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-40 bg-slate-800" />
                        <Skeleton className="h-2.5 w-28 bg-slate-800" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32 bg-slate-800" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-20 bg-slate-800" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-24 bg-slate-800" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-7 w-7 bg-slate-800" />
                  </TableCell>
                </TableRow>
              ))
            : rows.map((row) => {
                const role: AdminRole = isAdminRole(row.role)
                  ? row.role
                  : "teacher";
                const solo = isSoloAdmin(row);
                const pending = pendingRoleUserId === row.userId;

                return (
                  <TableRow
                    key={row.id}
                    className="border-slate-700/60 hover:bg-slate-800/30"
                  >
                    <TableCell className="py-3">
                      <UserCell name={row.name} email={row.email} />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-44">
                          <RoleSelect
                            value={role}
                            onChange={(next) => onRoleChange(row, next)}
                            disabled={solo || pending}
                            ariaLabel={`Alterar papel de ${row.name}`}
                          />
                        </div>
                        {solo && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                aria-label="Único administrador"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700/60 text-slate-400"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 border-slate-700 text-white text-xs">
                              Não é possível alterar — é o único administrador
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {formatRelativeTimePtBR(row.lastActiveAt)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {row.joinedVia === "domain" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-amber-300/70" />
                          {emailDomain(row.email)}
                        </span>
                      ) : row.joinedVia === "invitation" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                          {joinedViaLabel.invitation}
                        </span>
                      ) : (
                        joinedViaLabel.manual
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
                            aria-label={`Ações para ${row.name}`}
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
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onMove(row)}
                            className="text-slate-100 focus:bg-slate-800 focus:text-white data-[highlighted]:bg-slate-800 data-[highlighted]:text-white"
                          >
                            <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                            Mover para outra organização
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700/60" />
                          <DropdownMenuItem
                            onClick={() => onRemove(row)}
                            disabled={solo}
                            className="text-rose-300 focus:bg-rose-500/10 focus:text-rose-200 data-[highlighted]:bg-rose-500/10 data-[highlighted]:text-rose-200"
                          >
                            <UserMinus className="mr-2 h-3.5 w-3.5" />
                            Remover desta organização
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
