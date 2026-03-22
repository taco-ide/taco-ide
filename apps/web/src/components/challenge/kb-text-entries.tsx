"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { Loader2, Plus } from "lucide-react";
import {
  usePostV1KnowledgeBasesKbidEntries,
} from "@/kubb/hooks";

interface KbTextEntriesProps {
  knowledgeBaseId: string;
}

export function KbTextEntries({ knowledgeBaseId }: KbTextEntriesProps) {
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const createMutation = usePostV1KnowledgeBasesKbidEntries({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [{ url: "/v1/knowledge-bases/:kbId/entries/" }],
        });
        setNewContent("");
        setFeedback({ type: "success", message: "Entrada adicionada" });
      },
      onError: (err) => {
        setFeedback({
          type: "error",
          message: err.message ?? "Erro ao criar entrada",
        });
      },
    },
  });

  const handleCreate = () => {
    if (!newContent.trim()) return;
    setFeedback(null);
    createMutation.mutate({
      kbId: knowledgeBaseId,
      data: { content: newContent.trim() },
    });
  };

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

      <p className="text-slate-500 text-sm text-center py-4">
        Adicione notas de texto que serao incluidas na knowledge base como
        contexto adicional para o assistente de IA.
      </p>

      <PermissionGuard resource="knowledgeBase" action="create">
        <div className="border-t border-slate-700 pt-4 space-y-2">
          <Label className="text-slate-300 text-sm">
            Adicionar nova entrada
          </Label>
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Conteudo da entrada de knowledge base..."
            className="bg-slate-900 border-slate-700 text-slate-200 min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending || !newContent.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      </PermissionGuard>
    </div>
  );
}
