"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useGetV1ChallengesChallengeidSubmissions } from "@/kubb/hooks";

const PER_PAGE = 20;

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-slate-400">
        Acesso restrito a professores e coordenadores.
      </p>
    </div>
  );
}

function SubmissionsListContent() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useGetV1ChallengesChallengeidSubmissions(
    challengeId,
    { page, perPage: PER_PAGE },
    { query: { enabled: !!challengeId } }
  );

  const rows = data?.data ?? [];
  const pagination = data?.pagination ?? {
    total: 0,
    page: 1,
    perPage: PER_PAGE,
    totalPages: 0,
  };
  const totalPages = Math.max(1, pagination.totalPages || 1);

  return (
    <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-white">Submissões</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-200"
              onClick={() => router.push(`/create/${challengeId}/work-sessions`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ver sessões dos alunos
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <p className="text-center text-rose-400 py-8">
            {error instanceof Error
              ? error.message
              : "Não foi possível carregar as submissões."}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-500 py-12">
            Nenhuma submissão ainda.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/80">
                    <TableHead className="text-slate-200">Aluno</TableHead>
                    <TableHead className="text-slate-200">Submetida em</TableHead>
                    <TableHead className="text-slate-200">Auto-review</TableHead>
                    <TableHead className="text-slate-200">Nota</TableHead>
                    <TableHead className="text-slate-200 text-right w-32">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.submissionId}
                      className="border-slate-700 hover:bg-slate-800/60"
                    >
                      <TableCell className="text-slate-200 font-medium">
                        {row.studentName ?? "(usuário removido)"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDt(row.submittedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.autoReviewAt ? (
                          <span className="text-emerald-400/90">Disponível</span>
                        ) : (
                          <span className="text-amber-400/90">Pendente</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.grade ? (
                          <span className="inline-flex items-center rounded bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">
                            {row.grade}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          onClick={() =>
                            router.push(
                              `/create/${challengeId}/submissions/${row.submissionId}`
                            )
                          }
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
              <span>
                {pagination.total} submissão(ões) · Página {pagination.page} de{" "}
                {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  className="border-slate-600 bg-slate-800"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  className="border-slate-600 bg-slate-800"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        <p className="mt-8 text-center text-slate-600 text-sm">
          <Link href="/explore" className="hover:text-slate-400 underline">
            Explorar problemas
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ChallengeSubmissionsPage() {
  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <SubmissionsListContent />
    </RoleGuard>
  );
}
