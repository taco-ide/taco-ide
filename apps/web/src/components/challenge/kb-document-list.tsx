"use client";

import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { KbDocument } from "@/hooks/use-knowledge-base-documents";

interface KbDocumentListProps {
  documents: KbDocument[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: KbDocument["status"] }) {
  switch (status) {
    case "processing":
      return (
        <Badge className="border-transparent bg-yellow-500/20 text-yellow-400 animate-pulse">
          Processando
        </Badge>
      );
    case "ready":
      return (
        <Badge className="border-transparent bg-green-500/20 text-green-400">
          Pronto
        </Badge>
      );
    case "error":
      return (
        <Badge className="border-transparent bg-red-500/20 text-red-400">
          Erro
        </Badge>
      );
  }
}

export function KbDocumentList({
  documents,
  onDelete,
  isDeleting,
}: KbDocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <FileText className="w-10 h-10 mb-2" />
        <p className="text-sm">Nenhum documento enviado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{doc.filename}</p>
              <p className="text-xs text-slate-500">
                {formatFileSize(doc.fileSize)}
                {doc.status === "ready" && doc.chunkCount > 0 && (
                  <> &middot; {doc.chunkCount} chunks</>
                )}
                {doc.errorMessage && (
                  <span className="text-red-400">
                    {" "}
                    &middot; {doc.errorMessage}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={doc.status} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                  className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-800 border-slate-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">
                    Remover documento
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    Tem certeza que deseja remover &quot;{doc.filename}&quot;?
                    Esta acao nao pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(doc.id)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}
