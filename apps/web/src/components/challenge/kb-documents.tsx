"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useKnowledgeBaseDocuments } from "@/hooks/use-knowledge-base-documents";
import { KbDocumentUploadZone } from "./kb-document-upload-zone";
import { KbDocumentList } from "./kb-document-list";

interface KbDocumentsProps {
  knowledgeBaseId: string;
}

export function KbDocuments({ knowledgeBaseId }: KbDocumentsProps) {
  const t = useTranslations("knowledgeBase");
  const {
    documents,
    isLoading,
    upload,
    isUploading,
    deleteDocument,
    isDeleting,
  } = useKnowledgeBaseDocuments(knowledgeBaseId);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleUpload = async (file: File) => {
    setFeedback(null);
    try {
      await upload(file);
      setFeedback({ type: "success", message: t("documents.feedback.uploaded") });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : t("documents.feedback.uploadError"),
      });
    }
  };

  const handleDelete = async (docId: string) => {
    setFeedback(null);
    try {
      await deleteDocument(docId);
      setFeedback({ type: "success", message: t("documents.feedback.deleted") });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : t("documents.feedback.deleteError"),
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
