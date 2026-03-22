"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2, Unlink } from "lucide-react";
import { KbDocuments } from "./kb-documents";
import { KbTextEntries } from "./kb-text-entries";
import {
  useGetV1ChallengesChallengeidKnowledgeBases,
  useDeleteV1ChallengesChallengeidKnowledgeBasesKbid,
  getV1ChallengesChallengeidKnowledgeBasesQueryKey,
  usePostV1ChallengesChallengeidKnowledgeBases,
} from "@/kubb/hooks";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KnowledgeBaseSectionProps {
  challengeId: string;
}

export function KnowledgeBaseSection({
  challengeId,
}: KnowledgeBaseSectionProps) {
  const queryClient = useQueryClient();
  const [showLinkForm, setShowLinkForm] = useState(false);

  const { data: linkedKbsResponse, isLoading } =
    useGetV1ChallengesChallengeidKnowledgeBases(challengeId);

  const linkedKbs = linkedKbsResponse?.data ?? [];

  const unlinkMutation = useDeleteV1ChallengesChallengeidKnowledgeBasesKbid({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey:
            getV1ChallengesChallengeidKnowledgeBasesQueryKey(challengeId),
        });
      },
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
        </CardContent>
      </Card>
    );
  }

  if (linkedKbs.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-yellow-400" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showLinkForm ? (
            <KbLinkForm
              challengeId={challengeId}
              onCancel={() => setShowLinkForm(false)}
              onLinked={() => {
                setShowLinkForm(false);
                queryClient.invalidateQueries({
                  queryKey:
                    getV1ChallengesChallengeidKnowledgeBasesQueryKey(
                      challengeId
                    ),
                });
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <BookOpen className="w-10 h-10 mb-2" />
              <p className="text-sm mb-4">
                Nenhuma knowledge base vinculada a este desafio.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowLinkForm(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
              >
                Vincular Knowledge Base
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const activeKb = linkedKbs[0];

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-yellow-400" />
            {activeKb.title}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              unlinkMutation.mutate({
                challengeId,
                kbId: activeKb.id,
              })
            }
            disabled={unlinkMutation.isPending}
            className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
          >
            <Unlink className="w-3 h-3 mr-1" />
            Desvincular
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-700">
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-400"
            >
              Documentos
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-400"
            >
              Notas de Texto
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <KbDocuments knowledgeBaseId={activeKb.id} />
          </TabsContent>
          <TabsContent value="text">
            <KbTextEntries knowledgeBaseId={activeKb.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------- Link form sub-component ----------

interface KbLinkFormProps {
  challengeId: string;
  onCancel: () => void;
  onLinked: () => void;
}

function KbLinkForm({ challengeId, onCancel, onLinked }: KbLinkFormProps) {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkMutation = usePostV1ChallengesChallengeidKnowledgeBases({
    mutation: {
      onSuccess: () => onLinked(),
      onError: (err) => {
        setError(err.message ?? "Erro ao vincular knowledge base");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeBaseId.trim()) return;
    setError(null);
    linkMutation.mutate({
      challengeId,
      data: { knowledgeBaseId: knowledgeBaseId.trim() },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <Alert className="border-red-500/30 bg-red-500/10 text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">
          ID da Knowledge Base
        </Label>
        <Input
          value={knowledgeBaseId}
          onChange={(e) => setKnowledgeBaseId(e.target.value)}
          placeholder="Cole o ID da knowledge base aqui..."
          className="bg-slate-900 border-slate-700 text-slate-200"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={linkMutation.isPending || !knowledgeBaseId.trim()}
          className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
        >
          {linkMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : null}
          Vincular
        </Button>
      </div>
    </form>
  );
}
