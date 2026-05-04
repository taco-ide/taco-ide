"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleSlash,
  FileDown,
  FileSpreadsheet,
  Link2,
  Loader2,
  RefreshCcw,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CsvStepper, type CsvStep } from "@/components/admin/csv-stepper";
import { getV1OrganizationsIdMembersQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdMembers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_ROWS = 500;
const PREVIEW_ROW_LIMIT = 50;

const TEMPLATE_CSV =
  "name,email,password,role\n" +
  "Maria Silva,maria.silva@exemplo.edu.br,SenhaForte123!,student\n" +
  "João Santos,joao.santos@exemplo.edu.br,SenhaForte456!,teacher\n";

// ==================== Types ====================

type RowStatus = "created" | "linked" | "skipped" | "error";

type ImportRow = {
  line: number;
  email: string;
  status: RowStatus;
  message?: string;
};

type ImportSummary = {
  total: number;
  created: number;
  linked: number;
  skipped: number;
  errors: number;
};

type ImportResponseData = {
  dryRun: boolean;
  summary: ImportSummary;
  rows: ImportRow[];
};

type ImportApiResponse = {
  success: boolean;
  message?: string;
  data: ImportResponseData;
};

type ResultFilter = "all" | "created" | "linked" | "skipped" | "error";

export interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

// ==================== Helpers ====================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isCsvFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".csv")) return false;
  // Some browsers report empty type for .csv, others "text/csv" or
  // "application/vnd.ms-excel" — we accept all of those.
  if (
    file.type &&
    file.type !== "text/csv" &&
    file.type !== "application/vnd.ms-excel" &&
    file.type !== "application/csv"
  ) {
    return false;
  }
  return true;
}

function csvEscape(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function importCsvRequest(params: {
  organizationId: string;
  file: File;
  dryRun: boolean;
}): Promise<ImportResponseData> {
  const { organizationId, file, dryRun } = params;
  const url = `${API_BASE_URL}/v1/organizations/${encodeURIComponent(
    organizationId,
  )}/members/import-csv${dryRun ? "?dryRun=true" : ""}`;
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  let body: ImportApiResponse | { success: false; message?: string } | null =
    null;
  try {
    body = (await response.json()) as ImportApiResponse;
  } catch {
    // ignore parsing failure — fallthrough to error handling below
  }

  if (!response.ok) {
    const message =
      (body && "message" in body && body.message) ||
      `Falha na importação (HTTP ${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (!body || !("data" in body) || !body.data) {
    throw new Error("Resposta inválida do servidor");
  }

  return body.data;
}

// ==================== Sub components ====================

type StatKind = "success" | "info" | "ghost" | "danger";

interface SummaryStatProps {
  label: string;
  value: number;
  kind: StatKind;
  icon: React.ComponentType<{ className?: string }>;
}

const statKindClasses: Record<StatKind, string> = {
  success: "border-emerald-500/30 text-emerald-300",
  info: "border-sky-500/30 text-sky-300",
  ghost: "border-slate-600/40 text-slate-400",
  danger: "border-red-500/30 text-red-300",
};

function SummaryStat({ label, value, kind, icon: Icon }: SummaryStatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-slate-900/60 px-3 py-2.5",
        statKindClasses[kind],
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

interface BannerProps {
  kind: "warn" | "success" | "error";
  title: string;
  children?: React.ReactNode;
}

function Banner({ kind, title, children }: BannerProps) {
  const kindClass =
    kind === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : kind === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  const Icon =
    kind === "success" ? CheckCircle2 : kind === "error" ? X : AlertTriangle;
  return (
    <div className={cn("rounded-lg border p-3", kindClass)}>
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          {children && (
            <p className="text-xs text-slate-300/90 leading-relaxed">
              {children}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface RowStatusPillProps {
  status: RowStatus;
  variant: "preview" | "result";
}

function RowStatusPill({ status, variant }: RowStatusPillProps) {
  const baseMap: Record<
    RowStatus,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      className: string;
    }
  > = {
    created: {
      label: variant === "preview" ? "criar" : "criado",
      icon: UserPlus,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    linked: {
      label: variant === "preview" ? "vincular" : "vinculado",
      icon: Link2,
      className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    },
    skipped: {
      label: variant === "preview" ? "ignorar" : "ignorado",
      icon: CircleSlash,
      className: "border-slate-600/40 bg-slate-700/40 text-slate-300",
    },
    error: {
      label: "erro",
      icon: X,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    },
  };
  const { label, icon: Icon, className } = baseMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

interface CsvRowsTableProps {
  rows: ImportRow[];
  variant: "preview" | "result";
}

function CsvRowsTable({ rows, variant }: CsvRowsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-10 text-center text-sm text-slate-400">
        Nenhuma linha para exibir.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
      <div className="max-h-[340px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 backdrop-blur">
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="w-[6%] px-3 py-2 font-medium">#</th>
              <th className="w-[16%] px-3 py-2 font-medium">Status</th>
              <th className="w-[28%] px-3 py-2 font-medium">Email</th>
              <th className="w-[16%] px-3 py-2 font-medium">Linha</th>
              <th className="px-3 py-2 font-medium">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.line}
                className={cn(
                  "border-b border-slate-800/60 last:border-b-0",
                  row.status === "error" && "bg-red-500/[0.04]",
                )}
              >
                <td className="px-3 py-2 text-slate-500 tabular-nums">
                  {idx + 1}
                </td>
                <td className="px-3 py-2">
                  <RowStatusPill status={row.status} variant={variant} />
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-mono",
                    row.status === "error" ? "text-red-300" : "text-white",
                  )}
                >
                  {row.email || "—"}
                </td>
                <td className="px-3 py-2 text-slate-400 tabular-nums">
                  {row.line}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {row.message || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== Step 1: Upload ====================

interface UploadStepProps {
  file: File | null;
  fileError: string | null;
  onPickFile: (file: File | null) => void;
  onContinue: () => void;
  onCancel: () => void;
}

function UploadStep({
  file,
  fileError,
  onPickFile,
  onContinue,
  onCancel,
}: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileFromEvent = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onPickFile(files[0] ?? null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFileFromEvent(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDownloadTemplate = () => {
    downloadBlob("template-importacao-membros.csv", TEMPLATE_CSV, "text/csv");
  };

  return (
    <div className="space-y-4">
      <CsvStepper step="upload" />

      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
          isDragOver
            ? "border-amber-400/60 bg-amber-400/5"
            : file
              ? "border-emerald-500/40 bg-emerald-500/[0.04]"
              : "border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => handleFileFromEvent(event.target.files)}
        />
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border",
            file
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-slate-700 bg-slate-800 text-slate-300",
          )}
        >
          {file ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{file.name}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(file.size)} · clique para substituir
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Solte um arquivo CSV aqui
            </p>
            <p className="text-xs text-slate-400">
              ou{" "}
              <span className="underline decoration-dotted underline-offset-2">
                clique para escolher
              </span>{" "}
              · apenas .csv · máximo 1 MB
            </p>
          </div>
        )}
      </div>

      {fileError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {fileError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            Formato esperado
          </div>
          <pre className="overflow-x-auto rounded bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
            <code>
              <span className="text-slate-500"># colunas obrigatórias</span>
              {"\n"}
              <span className="text-amber-300">name</span>,
              <span className="text-amber-300">email</span>,
              <span className="text-amber-300">password</span>,
              <span className="text-amber-300">role</span>
              {"\n"}
              <span className="text-slate-400">
                Maria Silva,maria@exemplo.edu.br,SenhaForte123!,student
              </span>
              {"\n"}
              <span className="text-slate-400">
                João Santos,joao@exemplo.edu.br,SenhaForte456!,teacher
              </span>
            </code>
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">
            Papéis aceitos: <code>student</code>, <code>teacher</code>,{" "}
            <code>coordinator</code>, <code>admin</code>.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
            <FileDown className="h-4 w-4 text-amber-400" />
            Precisa de um modelo?
          </div>
          <p className="mb-3 text-xs text-slate-400 leading-relaxed">
            Baixe um template com cabeçalho correto e duas linhas de exemplo
            válidas para começar.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={handleDownloadTemplate}
          >
            <FileDown className="h-4 w-4" />
            Baixar template.csv
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!file}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          Continuar para prévia
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ==================== Step 2: Preview ====================

interface PreviewStepProps {
  data: ImportResponseData | undefined;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}

function PreviewStep({
  data,
  isLoading,
  error,
  onBack,
  onConfirm,
  onRetry,
}: PreviewStepProps) {
  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const errorCount = summary?.errors ?? 0;
  const totalRows = summary?.total ?? rows.length;
  const previewRows = rows.slice(0, PREVIEW_ROW_LIMIT);
  const importableCount = summary
    ? summary.created + summary.linked
    : 0;
  const ignoredCount = summary
    ? summary.skipped + summary.errors
    : 0;

  return (
    <div className="space-y-4">
      <CsvStepper step="preview" />

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <p className="text-sm text-slate-300">
            Validando o arquivo no servidor...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <Banner kind="error" title="Não foi possível validar o arquivo">
          {error}
        </Banner>
      )}

      {!isLoading && !error && summary && (
        <>
          <p className="text-xs text-slate-400">
            Mostrando {Math.min(PREVIEW_ROW_LIMIT, totalRows)} de {totalRows}{" "}
            {totalRows === 1 ? "linha" : "linhas"}.
          </p>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryStat
              label="Vai criar"
              value={summary.created}
              kind="success"
              icon={UserPlus}
            />
            <SummaryStat
              label="Vai vincular"
              value={summary.linked}
              kind="info"
              icon={Link2}
            />
            <SummaryStat
              label="Vai ignorar"
              value={summary.skipped}
              kind="ghost"
              icon={CircleSlash}
            />
            <SummaryStat
              label="Erros"
              value={summary.errors}
              kind="danger"
              icon={AlertTriangle}
            />
          </div>

          {errorCount > 0 && (
            <Banner
              kind="warn"
              title={`${errorCount} ${errorCount === 1 ? "linha tem" : "linhas têm"} problemas`}
            >
              Linhas com erros serão ignoradas. Você pode corrigi-las e enviar
              de novo, ou prosseguir e importar apenas as {importableCount}{" "}
              linhas válidas.
            </Banner>
          )}

          <CsvRowsTable rows={previewRows} variant="preview" />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {error && !isLoading && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
        <div className="flex-1" />
        {summary && (
          <span className="text-xs text-slate-400">
            {importableCount}{" "}
            {importableCount === 1 ? "linha será importada" : "linhas serão importadas"}{" "}
            · {ignoredCount}{" "}
            {ignoredCount === 1 ? "linha será ignorada" : "linhas serão ignoradas"}
          </span>
        )}
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || !!error || importableCount === 0}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Check className="h-4 w-4" />
          Confirmar e importar {importableCount}{" "}
          {importableCount === 1 ? "linha" : "linhas"}
        </Button>
      </div>
    </div>
  );
}

// ==================== Step 3: Result ====================

interface ResultStepProps {
  data: ImportResponseData | undefined;
  isLoading: boolean;
  error: string | null;
  filter: ResultFilter;
  onFilterChange: (filter: ResultFilter) => void;
  onClose: () => void;
  onRetry: () => void;
}

function ResultStep({
  data,
  isLoading,
  error,
  filter,
  onFilterChange,
  onClose,
  onRetry,
}: ResultStepProps) {
  const summary = data?.summary;
  const rows = data?.rows ?? [];

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  const handleDownloadReport = () => {
    if (rows.length === 0) return;
    const header = ["linha", "email", "status", "mensagem"];
    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.line),
          csvEscape(row.email),
          csvEscape(row.status),
          csvEscape(row.message ?? ""),
        ].join(","),
      );
    }
    downloadBlob(
      "relatorio-importacao-membros.csv",
      lines.join("\n") + "\n",
      "text/csv",
    );
  };

  const importedCount = summary ? summary.created + summary.linked : 0;
  const totalCount = summary?.total ?? rows.length;

  return (
    <div className="space-y-4">
      <CsvStepper step="result" />

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <p className="text-sm text-slate-300">
            Importando membros para a organização...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <Banner kind="error" title="Falha ao importar">
          {error}
        </Banner>
      )}

      {!isLoading && !error && summary && (
        <>
          <Banner
            kind="success"
            title={`${importedCount} de ${totalCount} ${
              totalCount === 1 ? "linha importada" : "linhas importadas"
            } com sucesso`}
          >
            Os novos usuários já podem entrar com a senha definida no CSV.
          </Banner>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryStat
              label="Criados"
              value={summary.created}
              kind="success"
              icon={UserPlus}
            />
            <SummaryStat
              label="Vinculados"
              value={summary.linked}
              kind="info"
              icon={Link2}
            />
            <SummaryStat
              label="Ignorados"
              value={summary.skipped}
              kind="ghost"
              icon={CircleSlash}
            />
            <SummaryStat
              label="Falharam"
              value={summary.errors}
              kind="danger"
              icon={AlertTriangle}
            />
          </div>

          <FilterBar
            filter={filter}
            counts={{
              all: rows.length,
              created: summary.created,
              linked: summary.linked,
              skipped: summary.skipped,
              error: summary.errors,
            }}
            onFilterChange={onFilterChange}
          />

          <CsvRowsTable rows={filteredRows} variant="result" />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadReport}
          disabled={isLoading || rows.length === 0}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <FileDown className="h-4 w-4" />
          Baixar relatório.csv
        </Button>
        {error && !isLoading && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
        <div className="flex-1" />
        <Button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Check className="h-4 w-4" />
          Concluído
        </Button>
      </div>
    </div>
  );
}

interface FilterBarProps {
  filter: ResultFilter;
  counts: {
    all: number;
    created: number;
    linked: number;
    skipped: number;
    error: number;
  };
  onFilterChange: (filter: ResultFilter) => void;
}

function FilterBar({ filter, counts, onFilterChange }: FilterBarProps) {
  const items: { key: ResultFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "created", label: "Criados", count: counts.created },
    { key: "linked", label: "Vinculados", count: counts.linked },
    { key: "skipped", label: "Ignorados", count: counts.skipped },
    { key: "error", label: "Erros", count: counts.error },
  ];
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {items.map((item) => {
        const isActive = filter === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange(item.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded px-1 text-[11px] tabular-nums",
                isActive ? "text-slate-400" : "text-slate-500",
              )}
            >
              · {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ==================== Main component ====================

export function CsvImportModal({
  open,
  onOpenChange,
  organizationId,
}: CsvImportModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<CsvStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportResponseData | undefined>(
    undefined,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ImportResponseData | undefined>(
    undefined,
  );
  const [resultError, setResultError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFile(null);
      setFileError(null);
      setPreviewData(undefined);
      setPreviewError(null);
      setResultData(undefined);
      setResultError(null);
      setFilter("all");
    }
  }, [open]);

  const previewMutation = useMutation({
    mutationFn: (params: { file: File }) =>
      importCsvRequest({
        organizationId,
        file: params.file,
        dryRun: true,
      }),
    onSuccess: (data) => {
      setPreviewData(data);
      setPreviewError(null);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Erro inesperado na validação";
      setPreviewError(message);
    },
  });

  const importMutation = useMutation({
    mutationFn: (params: { file: File }) =>
      importCsvRequest({
        organizationId,
        file: params.file,
        dryRun: false,
      }),
    onSuccess: (data) => {
      setResultData(data);
      setResultError(null);
      void queryClient.invalidateQueries({
        queryKey: getV1OrganizationsIdMembersQueryKey(organizationId),
      });
      const imported = data.summary.created + data.summary.linked;
      toast.success(
        `${imported} ${imported === 1 ? "linha importada" : "linhas importadas"}`,
      );
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Erro inesperado na importação";
      setResultError(message);
      toast.error("Falha ao importar membros");
    },
  });

  const handlePickFile = useCallback((nextFile: File | null) => {
    setFileError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!isCsvFile(nextFile)) {
      setFile(null);
      setFileError("O arquivo deve ter extensão .csv");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setFileError(
        `O arquivo excede o limite de 1 MB (${formatBytes(nextFile.size)}).`,
      );
      return;
    }
    setFile(nextFile);
  }, []);

  const runPreview = useCallback(
    (target: File) => {
      setPreviewData(undefined);
      setPreviewError(null);
      previewMutation.mutate({ file: target });
    },
    [previewMutation],
  );

  const runImport = useCallback(
    (target: File) => {
      setResultData(undefined);
      setResultError(null);
      importMutation.mutate({ file: target });
    },
    [importMutation],
  );

  const handleContinueToPreview = () => {
    if (!file) return;
    setStep("preview");
    runPreview(file);
  };

  const handleConfirmImport = () => {
    if (!file) return;
    setStep("result");
    runImport(file);
  };

  const handleBackToUpload = () => {
    setStep("upload");
    setPreviewData(undefined);
    setPreviewError(null);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const dialogTitle =
    step === "upload"
      ? "Importar membros de CSV"
      : step === "preview"
        ? "Prévia e validação"
        : "Importação concluída";
  const dialogSubtitle =
    step === "upload"
      ? "Adicione usuários em massa a esta organização."
      : step === "preview"
        ? "Revise o que será aplicado para cada linha antes de importar."
        : "Resumo do que foi aplicado a esta organização.";

  // Disable closing while a real import is in flight to avoid losing state.
  const handleDialogChange = (next: boolean) => {
    if (!next && importMutation.isPending) {
      return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {dialogSubtitle}
          </DialogDescription>
        </DialogHeader>
        {step === "upload" && (
          <UploadStep
            file={file}
            fileError={fileError}
            onPickFile={handlePickFile}
            onContinue={handleContinueToPreview}
            onCancel={handleClose}
          />
        )}
        {step === "preview" && (
          <PreviewStep
            data={previewData}
            isLoading={previewMutation.isPending}
            error={previewError}
            onBack={handleBackToUpload}
            onConfirm={handleConfirmImport}
            onRetry={() => file && runPreview(file)}
          />
        )}
        {step === "result" && (
          <ResultStep
            data={resultData}
            isLoading={importMutation.isPending}
            error={resultError}
            filter={filter}
            onFilterChange={setFilter}
            onClose={handleClose}
            onRetry={() => file && runImport(file)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
