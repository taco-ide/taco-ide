"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface KbDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  status: "processing" | "ready" | "error";
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

  const listQuery = useQuery({
    queryKey: kbDocumentsKeys.all(knowledgeBaseId),
    queryFn: async (): Promise<KbDocument[]> => {
      const res = await fetch(
        `${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/documents`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch documents");
      const json: ListDocumentsResponse = await res.json();
      return json.data;
    },
    enabled: !!knowledgeBaseId,
    retry: 3,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some((d) => d.status === "processing")) return 3000;
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
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
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
      if (!res.ok) throw new Error("Failed to delete document");
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
