"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import {
    Loader2,
    Plus,
    Pencil,
    Trash2,
    BookOpen,
    Save,
} from "lucide-react";
import {
    useGetV1ChallengesIdKnowledgeBase,
    usePostV1ChallengesIdKnowledgeBase,
    usePutV1ChallengesIdKnowledgeBaseKbid,
    useDeleteV1ChallengesIdKnowledgeBaseKbid,
    getV1ChallengesIdKnowledgeBaseQueryKey,
} from "@/kubb/hooks";

export function KnowledgeBaseSection({ challengeId }: { challengeId: string }) {
    const queryClient = useQueryClient();
    const [newContent, setNewContent] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [kbFeedback, setKbFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const { data: kbData, isLoading: kbLoading } = useGetV1ChallengesIdKnowledgeBase(
        challengeId,
        { page: 1, perPage: 100 },
    );

    const entries = kbData?.data ?? [];

    const createMutation = usePostV1ChallengesIdKnowledgeBase({
        mutation: {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: getV1ChallengesIdKnowledgeBaseQueryKey(challengeId),
                });
                setNewContent("");
                setKbFeedback({ type: "success", message: "Entrada adicionada" });
            },
            onError: (err) => {
                setKbFeedback({ type: "error", message: err.message ?? "Erro ao criar entrada" });
            },
        },
    });

    const updateMutation = usePutV1ChallengesIdKnowledgeBaseKbid({
        mutation: {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: getV1ChallengesIdKnowledgeBaseQueryKey(challengeId),
                });
                setEditingId(null);
                setEditingContent("");
                setKbFeedback({ type: "success", message: "Entrada atualizada" });
            },
            onError: (err) => {
                setKbFeedback({ type: "error", message: err.message ?? "Erro ao atualizar entrada" });
            },
        },
    });

    const deleteMutation = useDeleteV1ChallengesIdKnowledgeBaseKbid({
        mutation: {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: getV1ChallengesIdKnowledgeBaseQueryKey(challengeId),
                });
                setKbFeedback({ type: "success", message: "Entrada removida" });
            },
            onError: (err) => {
                setKbFeedback({ type: "error", message: err.message ?? "Erro ao remover entrada" });
            },
        },
    });

    const handleCreate = () => {
        if (!newContent.trim()) return;
        setKbFeedback(null);
        createMutation.mutate({ id: challengeId, data: { content: newContent.trim() } });
    };

    const handleUpdate = (kbId: string) => {
        if (!editingContent.trim()) return;
        setKbFeedback(null);
        updateMutation.mutate({ id: challengeId, kbId, data: { content: editingContent.trim() } });
    };

    const handleDelete = (kbId: string) => {
        setKbFeedback(null);
        deleteMutation.mutate({ id: challengeId, kbId });
    };

    const startEditing = (id: string, content: string) => {
        setEditingId(id);
        setEditingContent(content);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditingContent("");
    };

    return (
        <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-base">
                    <BookOpen className="w-4 h-4 text-yellow-400" />
                    Knowledge Base
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {kbFeedback && (
                    <Alert
                        className={
                            kbFeedback.type === "success"
                                ? "border-green-500/30 bg-green-500/10 text-green-400"
                                : "border-red-500/30 bg-red-500/10 text-red-400"
                        }
                    >
                        <AlertDescription>{kbFeedback.message}</AlertDescription>
                    </Alert>
                )}

                {kbLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {entries.length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">
                                Nenhuma entrada na knowledge base ainda.
                            </p>
                        )}
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="rounded-lg border border-slate-700 bg-slate-900 p-4"
                            >
                                {editingId === entry.id ? (
                                    <div className="space-y-2">
                                        <Textarea
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            className="bg-slate-800 border-slate-600 text-slate-200 min-h-[100px]"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={cancelEditing}
                                                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleUpdate(entry.id)}
                                                disabled={updateMutation.isPending}
                                                className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
                                            >
                                                {updateMutation.isPending ? (
                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                ) : (
                                                    <Save className="w-3 h-3 mr-1" />
                                                )}
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-slate-300 text-sm whitespace-pre-wrap flex-1">
                                            {entry.content}
                                        </p>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <PermissionGuard resource="knowledgeBase" action="update">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEditing(entry.id, entry.content)}
                                                    className="text-slate-400 hover:text-yellow-400 hover:bg-slate-800"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                            </PermissionGuard>
                                            <PermissionGuard resource="knowledgeBase" action="delete">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-slate-800 border-slate-700">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-white">
                                                                Remover entrada
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription className="text-slate-400">
                                                                Tem certeza que deseja remover esta entrada da knowledge base?
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
                                                                Cancelar
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(entry.id)}
                                                                className="bg-red-600 hover:bg-red-700 text-white"
                                                            >
                                                                Remover
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </PermissionGuard>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <PermissionGuard resource="knowledgeBase" action="create">
                    <div className="border-t border-slate-700 pt-4 space-y-2">
                        <Label className="text-slate-300 text-sm">Adicionar nova entrada</Label>
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
            </CardContent>
        </Card>
    );
}
