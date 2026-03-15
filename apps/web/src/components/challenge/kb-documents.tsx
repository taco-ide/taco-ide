"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useKnowledgeBaseDocuments } from "@/hooks/use-knowledge-base-documents";
import { KbDocumentUploadZone } from "./kb-document-upload-zone";
import { KbDocumentList } from "./kb-document-list";

interface KbDocumentsProps {
  challengeId: string;
}

export function KbDocuments({ challengeId }: KbDocumentsProps) {
  const {
    documents,
    isLoading,
    upload,
    isUploading,
    deleteDocument,
    isDeleting,
  } = useKnowledgeBaseDocuments(challengeId);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleUpload = async (file: File) => {
    setFeedback(null);
    try {
      await upload(file);
      setFeedback({ type: "success", message: "Documento enviado com sucesso" });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao enviar documento",
      });
    }
  };

  const handleDelete = async (docId: string) => {
    setFeedback(null);
    try {
      await deleteDocument(docId);
      setFeedback({ type: "success", message: "Documento removido" });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao remover documento",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert
          className={
            feedback.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }
        >
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <KbDocumentUploadZone onUpload={handleUpload} isUploading={isUploading} />
      <KbDocumentList
        documents={documents}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
