"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Laptop,
  Loader2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useGetV1ChallengesChallengeidWorkSessions } from "@/kubb/hooks";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

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
      <p className="text-slate-400">Acesso restrito a professores e coordenadores.</p>
    </div>
  );
}

function WorkSessionsListContent() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [page, setPage] = useState(1);
  const [submittedOnly, setSubmittedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, submittedOnly]);

  const { data, isLoading, error } = useGetV1ChallengesChallengeidWorkSessions(
    challengeId,
    {
      page,
      perPage: PER_PAGE,
      ...(submittedOnly ? { submittedOnly: "true" } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-white">Sessões dos alunos</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-200"
              onClick={() => router.push(`/create/${challengeId}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Editar problema
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-medium"
              onClick={() =>
                router.push(`/problem/${challengeId}?view=student`)
              }
            >
              <Laptop className="w-4 h-4 mr-2" />
              Visualização do aluno
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-2">
            <input
              id="submitted-only"
              type="checkbox"
              checked={submittedOnly}
              onChange={(e) => setSubmittedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
            />
            <Label htmlFor="submitted-only" className="text-slate-200 cursor-pointer">
              Apenas submetidas
            </Label>
          </div>
          <div className="w-full sm:max-w-xs">
            <Label htmlFor="search-name" className="text-slate-400 text-xs mb-1 block">
              Buscar por nome do aluno
            </Label>
            <Input
              id="search-name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nome..."
              className="bg-slate-900 border-slate-600 text-slate-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <p className="text-center text-rose-400 py-8">
            {error instanceof Error ? error.message : "Não foi possível carregar as sessões."}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-500 py-12">Nenhuma sessão encontrada.</p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/80">
                    <TableHead className="text-slate-200">Aluno</TableHead>
                    <TableHead className="text-slate-200">Estado</TableHead>
                    <TableHead className="text-slate-200">Criada em</TableHead>
                    <TableHead className="text-slate-200">Última mensagem</TableHead>
                    <TableHead className="text-slate-200 text-right w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.workSessionId}
                      className="border-slate-700 hover:bg-slate-800/60"
                    >
                      <TableCell className="text-slate-200 font-medium">
                        {row.studentName}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {row.endedAt ? (
                          <span className="text-emerald-400/90">Submetida</span>
                        ) : (
                          <span className="text-amber-400/90">Em andamento</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDt(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDt(row.lastMessageAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          onClick={() =>
                            router.push(
                              `/create/${challengeId}/work-sessions/${row.workSessionId}/replay`
                            )
                          }
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Replay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
              <span>
                {pagination.total} sessão(ões) · Página {pagination.page} de {totalPages}
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

export default function ChallengeWorkSessionsPage() {
  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <WorkSessionsListContent />
    </RoleGuard>
  );
}
