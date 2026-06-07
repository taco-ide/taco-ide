"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type KbDocumentStatus =
  | "uploading"
  | "converting"
  | "chunking"
  | "embedding"
  | "ready"
  | "error";

const PENDING_STATUSES: KbDocumentStatus[] = [
  "uploading",
  "converting",
  "chunking",
  "embedding",
];

export interface KbDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  status: KbDocumentStatus;
  errorMessage: string | null;
  createdAt: string;
}

interface ListDocumentsResponse {
  success: boolean;
  data: KbDocument[];
}

const kbDocumentsKeys = {
  all: (knowledgeBaseId: string) =>
    ["kb-documents", knowledgeBaseId] as const,
};

export function useKnowledgeBaseDocuments(knowledgeBaseId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("knowledgeBase");

  const listQuery = useQuery({
    queryKey: kbDocumentsKeys.all(knowledgeBaseId),
    queryFn: async (): Promise<KbDocument[]> => {
      const res = await fetch(
        `${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/documents`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(t("hookErrors.fetch"));
      const json: ListDocumentsResponse = await res.json();
      return json.data;
    },
    enabled: !!knowledgeBaseId,
    retry: 3,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some((d) => PENDING_STATUSES.includes(d.status))) return 3000;
      return false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/documents/`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: t("hookErrors.upload") }));
        throw new Error(err.message || t("hookErrors.upload"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: kbDocumentsKeys.all(knowledgeBaseId),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(
        `${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/documents/${docId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error(t("hookErrors.delete"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: kbDocumentsKeys.all(knowledgeBaseId),
      });
    },
  });

  return {
    documents: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
