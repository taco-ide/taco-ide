"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Loader2,
  Unlink,
  Plus,
  Link,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { KbDocuments } from "./kb-documents";
import { KbTextEntries } from "./kb-text-entries";
import {
  useGetV1ChallengesChallengeidKnowledgeBases,
  useDeleteV1ChallengesChallengeidKnowledgeBasesKbid,
  getV1ChallengesChallengeidKnowledgeBasesQueryKey,
  usePostV1ChallengesChallengeidKnowledgeBases,
  useGetV1KnowledgeBases,
  usePostV1KnowledgeBases,
  getV1KnowledgeBasesQueryKey,
} from "@/kubb/hooks";
import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import apiClient from "@/lib/apiClient";

// ---------- Types ----------

interface KnowledgeBaseSectionProps {
  challengeId: string;
}

interface ChallengeResponse {
  success: boolean;
  data: {
    id: string;
    classroomId: string | null;
    classroomTitle: string | null;
  };
}

type ActionMode = "idle" | "create" | "link";

// ---------- Hook to fetch classroomId ----------

function useChallengeClassroomId(challengeId: string) {
  return useQuery({
    queryKey: [{ url: "/v1/challenges/:id/classroom", params: { id: challengeId } }],
    queryFn: async () => {
      const res = await apiClient<ChallengeResponse>({
        method: "GET",
        url: `/v1/challenges/${challengeId}`,
      });
      return res.data;
    },
    enabled: !!challengeId,
    select: (data) => ({
      classroomId: data.data.classroomId,
      classroomTitle: data.data.classroomTitle,
    }),
  });
}

// ---------- Main component ----------

export function KnowledgeBaseSection({
  challengeId,
}: KnowledgeBaseSectionProps) {
  const queryClient = useQueryClient();

  const { data: challengeInfo, isLoading: isLoadingChallenge } =
    useChallengeClassroomId(challengeId);

  const { data: linkedKbsResponse, isLoading: isLoadingKbs } =
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

  const isLoading = isLoadingChallenge || isLoadingKbs;

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
        </CardContent>
      </Card>
    );
  }

  const classroomId = challengeInfo?.classroomId ?? null;

  // No classroom linked
  if (!classroomId) {
    return <NoClassroomWarning />;
  }

  // Has linked KB -- show documents/text tabs
  if (linkedKbs.length > 0) {
    const activeKb = linkedKbs[0];
    return (
      <LinkedKbView
        challengeId={challengeId}
        kb={activeKb}
        unlinkMutation={unlinkMutation}
      />
    );
  }

  // Has classroom but no KB linked
  return (
    <EmptyKbState
      challengeId={challengeId}
      classroomId={classroomId}
    />
  );
}

// ---------- No classroom warning ----------

function NoClassroomWarning() {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-yellow-400" />
          Knowledge Base
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <AlertDescription className="text-yellow-300">
            Vincule este exercicio a uma turma para usar Knowledge Base.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// ---------- Linked KB view (existing behavior) ----------

interface LinkedKbViewProps {
  challengeId: string;
  kb: { id: string; title: string };
  unlinkMutation: ReturnType<typeof useDeleteV1ChallengesChallengeidKnowledgeBasesKbid>;
}

function LinkedKbView({ challengeId, kb, unlinkMutation }: LinkedKbViewProps) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-yellow-400" />
            {kb.title}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              unlinkMutation.mutate({
                challengeId,
                kbId: kb.id,
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
            <KbDocuments knowledgeBaseId={kb.id} />
          </TabsContent>
          <TabsContent value="text">
            <KbTextEntries knowledgeBaseId={kb.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------- Empty KB state (create or link) ----------

interface EmptyKbStateProps {
  challengeId: string;
  classroomId: string;
}

function EmptyKbState({ challengeId, classroomId }: EmptyKbStateProps) {
  const [actionMode, setActionMode] = useState<ActionMode>("idle");

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-yellow-400" />
          Knowledge Base
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actionMode === "idle" && (
          <IdleActions onSelect={setActionMode} />
        )}
        {actionMode === "create" && (
          <CreateKbForm
            challengeId={challengeId}
            classroomId={classroomId}
            onCancel={() => setActionMode("idle")}
          />
        )}
        {actionMode === "link" && (
          <LinkExistingKb
            challengeId={challengeId}
            classroomId={classroomId}
            onCancel={() => setActionMode("idle")}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Idle action buttons ----------

function IdleActions({ onSelect }: { onSelect: (mode: ActionMode) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
      <BookOpen className="w-10 h-10 mb-2" />
      <p className="text-sm mb-6 text-slate-400">
        Nenhuma knowledge base vinculada a este desafio.
      </p>
      <div className="flex gap-3">
        <Button
          type="button"
          size="sm"
          onClick={() => onSelect("create")}
          className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
        >
          <Plus className="w-3 h-3 mr-1" />
          Criar Nova Knowledge Base
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect("link")}
          className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
        >
          <Link className="w-3 h-3 mr-1" />
          Vincular Existente
        </Button>
      </div>
    </div>
  );
}

// ---------- Create new KB form ----------

interface CreateKbFormProps {
  challengeId: string;
  classroomId: string;
  onCancel: () => void;
}

function CreateKbForm({ challengeId, classroomId, onCancel }: CreateKbFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkMutation = usePostV1ChallengesChallengeidKnowledgeBases({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey:
            getV1ChallengesChallengeidKnowledgeBasesQueryKey(challengeId),
        });
      },
      onError: (err) => {
        setError(err.message ?? "Erro ao vincular knowledge base");
      },
    },
  });

  const createMutation = usePostV1KnowledgeBases({
    mutation: {
      onSuccess: (res) => {
        linkMutation.mutate({
          challengeId,
          data: { knowledgeBaseId: res.data.id },
        });
      },
      onError: (err) => {
        setError(err.message ?? "Erro ao criar knowledge base");
      },
    },
  });

  const isPending = createMutation.isPending || linkMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    createMutation.mutate({
      data: { title: title.trim(), classroomId },
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
          Titulo da Knowledge Base
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Material do Modulo 3..."
          className="bg-slate-900 border-slate-700 text-slate-200"
          autoFocus
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
          disabled={isPending || !title.trim()}
          className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : null}
          Criar e Vincular
        </Button>
      </div>
    </form>
  );
}

// ---------- Link existing KB ----------

interface LinkExistingKbProps {
  challengeId: string;
  classroomId: string;
  onCancel: () => void;
}

function LinkExistingKb({ challengeId, classroomId, onCancel }: LinkExistingKbProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: kbsResponse, isLoading } = useGetV1KnowledgeBases(
    { classroomId, perPage: 100 },
  );

  const availableKbs = kbsResponse?.data ?? [];

  const linkMutation = usePostV1ChallengesChallengeidKnowledgeBases({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey:
            getV1ChallengesChallengeidKnowledgeBasesQueryKey(challengeId),
        });
        queryClient.invalidateQueries({
          queryKey: getV1KnowledgeBasesQueryKey({ classroomId }),
        });
      },
      onError: (err) => {
        setError(err.message ?? "Erro ao vincular knowledge base");
      },
    },
  });

  const handleLink = (knowledgeBaseId: string) => {
    setError(null);
    linkMutation.mutate({
      challengeId,
      data: { knowledgeBaseId },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert className="border-red-500/30 bg-red-500/10 text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {availableKbs.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-500" />
          <p className="text-sm">
            Nenhuma knowledge base encontrada nesta turma.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {availableKbs.map((kb) => (
            <button
              key={kb.id}
              type="button"
              onClick={() => handleLink(kb.id)}
              disabled={linkMutation.isPending}
              className="w-full flex items-center justify-between p-3 rounded-md bg-slate-900 border border-slate-700 hover:border-yellow-500/50 hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {kb.title}
                </p>
                <p className="text-xs text-slate-500">
                  {kb.documentCount} documento{kb.documentCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Link className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
        >
          Voltar
        </Button>
      </div>
    </div>
  );
}
