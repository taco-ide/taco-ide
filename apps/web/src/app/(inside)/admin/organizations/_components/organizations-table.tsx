"use client";

import Link from "next/link";
import { CirclePause, CirclePlay, Eye, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgCell } from "@/components/admin/org-cell";
import { StatusPill } from "@/components/admin/status-pill";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  classroomCount: number;
}

interface OrganizationsTableProps {
  rows: OrganizationRow[];
  isLoading: boolean;
  onEdit: (org: OrganizationRow) => void;
  onToggleActive: (org: OrganizationRow) => void;
  togglingId?: string;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

export function OrganizationsTable({
  rows,
  isLoading,
  onEdit,
  onToggleActive,
  togglingId,
}: OrganizationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700/60 hover:bg-transparent">
          <TableHead className="text-slate-400">Organização</TableHead>
          <TableHead className="text-slate-400">Status</TableHead>
          <TableHead className="text-right text-slate-400">Membros</TableHead>
          <TableHead className="text-right text-slate-400">Turmas</TableHead>
          <TableHead className="text-slate-400">Criada em</TableHead>
          <TableHead className="text-right text-slate-400">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="border-slate-700/60">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg bg-slate-800" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-40 bg-slate-800" />
                      <Skeleton className="h-2.5 w-20 bg-slate-800" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 bg-slate-800" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-3 w-8 bg-slate-800" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-3 w-8 bg-slate-800" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 bg-slate-800" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-7 w-20 bg-slate-800" />
                </TableCell>
              </TableRow>
            ))
          : rows.map((org) => (
              <TableRow
                key={org.id}
                className="border-slate-700/60 hover:bg-slate-800/40"
              >
                <TableCell className="py-3">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="block"
                  >
                    <OrgCell
                      name={org.name}
                      slug={org.slug}
                      logo={org.logo}
                    />
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusPill active={org.isActive} />
                </TableCell>
                <TableCell className="text-right text-sm font-medium text-white">
                  {org.memberCount}
                </TableCell>
                <TableCell className="text-right text-sm font-medium text-white">
                  {org.classroomCount}
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {formatDate(org.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      title="Ver"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      title="Editar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
                      onClick={() => onEdit(org)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={org.isActive ? "Desativar" : "Reativar"}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white disabled:opacity-50"
                      onClick={() => onToggleActive(org)}
                      disabled={togglingId === org.id}
                    >
                      {org.isActive ? (
                        <CirclePause className="h-4 w-4" />
                      ) : (
                        <CirclePlay className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
