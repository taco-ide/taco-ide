"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRemark } from "react-remark";
import { Text } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    X,
    Save,
    ShieldAlert,
    Loader2,
    Plus,
    Pencil,
    Trash2,
    BookOpen,
} from "lucide-react";
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
import { RoleGuard } from "@/components/guards/RoleGuard";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import {
    useGetV1ChallengesId,
    usePutV1ChallengesId,
    getV1ChallengesQueryKey,
    getV1ChallengesIdQueryKey,
    useGetV1ChallengesIdKnowledgeBase,
    usePostV1ChallengesIdKnowledgeBase,
    usePutV1ChallengesIdKnowledgeBaseKbid,
    useDeleteV1ChallengesIdKnowledgeBaseKbid,
    getV1ChallengesIdKnowledgeBaseQueryKey,
} from "@/kubb/hooks";

const personalityTypes = [
    { id: "assertive", name: "Assertive", description: "Direct and objective in responses" },
    { id: "explanatory", name: "Explanatory", description: "Provides detailed explanations" },
    { id: "socratic", name: "Socratic", description: "Guides through questions" },
    { id: "encouraging", name: "Encouraging", description: "Motivates and encourages during resolution" },
];

const difficultyLevels = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
] as const;

const editChallengeSchema = z.object({
    title: z.string().min(1, "Titulo e obrigatorio").max(200),
    description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"], {
        required_error: "Selecione a dificuldade",
    }),
    tags: z.array(z.string()).optional(),
});

type EditChallengeFormData = z.infer<typeof editChallengeSchema>;

function AccessDenied() {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
                <p className="text-slate-400">Apenas professores e coordenadores podem editar problemas.</p>
            </div>
        </div>
    );
}

function KnowledgeBaseSection({ challengeId }: { challengeId: string }) {
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

export default function EditChallengePage() {
    const router = useRouter();
    const params = useParams();
    const challengeId = params.id as string;
    const queryClient = useQueryClient();

    const [tags, setTags] = useState<string[]>([]);
    const [tagsInitialized, setTagsInitialized] = useState(false);
    const [currentTag, setCurrentTag] = useState("");
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const { data: challengeData, isLoading, error } = useGetV1ChallengesId(challengeId);

    const challenge = challengeData?.data;

    // Initialize tags from fetched data
    if (challenge && !tagsInitialized) {
        setTags(challenge.tags ?? []);
        setTagsInitialized(true);
    }

    const mutation = usePutV1ChallengesId({
        mutation: {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
                queryClient.invalidateQueries({ queryKey: getV1ChallengesIdQueryKey(challengeId) });
                router.push("/explore");
            },
            onError: (err) => {
                setFeedback({
                    type: "error",
                    message: err.message ?? "Erro ao atualizar problema",
                });
            },
        },
    });

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<EditChallengeFormData>({
        resolver: zodResolver(editChallengeSchema),
        values: challenge
            ? {
                  title: challenge.title,
                  description: challenge.description ?? "",
                  difficulty: (challenge.difficulty as "easy" | "medium" | "hard") ?? "easy",
                  tags: challenge.tags ?? [],
              }
            : undefined,
    });

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (currentTag.trim() !== "") {
                setTags([...tags, currentTag.trim()]);
                setCurrentTag("");
            }
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    const [reactContent, setMarkdownSource] = useRemark();

    const onSubmit = (data: EditChallengeFormData) => {
        setFeedback(null);
        mutation.mutate({
            id: challengeId,
            data: {
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                tags: tags.length > 0 ? tags : undefined,
            },
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            </div>
        );
    }

    if (error || !challenge) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">Problema nao encontrado</h2>
                    <p className="text-slate-400">
                        {error instanceof Error ? error.message : "O problema solicitado nao existe ou foi removido."}
                    </p>
                    <Button
                        onClick={() => router.push("/explore")}
                        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
                    >
                        Voltar ao Explorar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-12 text-center">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-3">
                        Edit Problem
                    </h1>
                    <p className="text-slate-400 text-lg">Update your programming challenge</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-6">
                        <Card className="p-6 bg-slate-800 border-slate-700">
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-slate-200">Problem Title</Label>
                                    <Input
                                        {...register("title")}
                                        placeholder="Ex: Quick Sort Implementation"
                                        className="bg-slate-900 border-slate-700 text-slate-200"
                                    />
                                    {errors.title && (
                                        <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-slate-200">Problem Short Description</Label>
                                    <Input
                                        {...register("description")}
                                        placeholder="Ex: Implement the quick sort algorithm in your preferred language"
                                        className="bg-slate-900 border-slate-700 text-slate-200"
                                    />
                                    {errors.description && (
                                        <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-slate-200">Difficulty</Label>
                                    <Controller
                                        control={control}
                                        name="difficulty"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                                    <SelectValue placeholder="Select difficulty" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    {difficultyLevels.map((level) => (
                                                        <SelectItem
                                                            key={level.value}
                                                            value={level.value}
                                                            className="text-slate-200 focus:bg-slate-700"
                                                        >
                                                            {level.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.difficulty && (
                                        <p className="text-red-400 text-sm mt-1">{errors.difficulty.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-slate-200">Tags</Label>
                                    <div className="space-y-2">
                                        <Input
                                            value={currentTag}
                                            onChange={(e) => setCurrentTag(e.target.value)}
                                            onKeyDown={handleAddTag}
                                            placeholder="Type a tag and press Enter"
                                            className="bg-slate-900 border-slate-700 text-slate-200"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    variant="secondary"
                                                    className="bg-slate-700/50 backdrop-blur-sm hover:bg-slate-600 cursor-pointer px-3 py-1 transition-all duration-200"
                                                    onClick={() => removeTag(tag)}
                                                >
                                                    {tag}
                                                    <X className="w-3 h-3 ml-2 inline-block" />
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-slate-200">Reference Material (PDF)</Label>
                                    <Input
                                        type="file"
                                        accept=".pdf"
                                        className="bg-slate-900 border-slate-700 text-slate-200"
                                    />
                                </div>

                                <div>
                                    <Label className="text-slate-200">Assistant Personality</Label>
                                    <Select>
                                        <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                            <SelectValue placeholder="Select personality" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            {personalityTypes.map((personality) => (
                                                <SelectItem
                                                    key={personality.id}
                                                    value={personality.id}
                                                    className="text-slate-200 focus:bg-slate-700"
                                                >
                                                    <div>
                                                        <div className="font-medium">{personality.name}</div>
                                                        <div className="text-xs text-slate-400">{personality.description}</div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="my-12 flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-800"></div>
                        <span className="text-slate-400 font-medium">Problem Description</span>
                        <div className="h-px flex-1 bg-slate-800"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <Card className="p-6 bg-slate-800 border-slate-700">
                                <div className="space-y-4">
                                    <Label className="text-slate-200">Problem Description Raw</Label>
                                    <Textarea
                                        placeholder="Type the problem text here... Markdown supported"
                                        className="min-h-[500px] bg-slate-900 border-slate-700 text-slate-200"
                                        onChange={({ currentTarget }) => setMarkdownSource(currentTarget.value)}
                                    />
                                </div>
                            </Card>
                        </div>
                        <div>
                            <Card className="bg-[#1a1f2e] text-white flex flex-col h-full">
                                <CardHeader>
                                    <CardTitle>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center justify-center rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50">
                                                    <Text className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-300">Problem Description Preview</span>
                                            </div>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="w-full h-[60vh]">
                                        <div className="prose prose-sm prose-invert animate-fade-in">
                                            {reactContent}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {feedback && (
                        <Alert
                            className={`mt-6 ${
                                feedback.type === "success"
                                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                                    : "border-red-500/30 bg-red-500/10 text-red-400"
                            }`}
                        >
                            <AlertDescription>{feedback.message}</AlertDescription>
                        </Alert>
                    )}

                    <div className="mt-8 flex justify-end gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/explore")}
                            className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors duration-200 flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={mutation.isPending}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium transition-all duration-200 flex items-center gap-2"
                        >
                            {mutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Update Problem
                        </Button>
                    </div>
                </form>

                {/* Knowledge Base Section */}
                <div className="my-12 flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-800"></div>
                    <span className="text-slate-400 font-medium">Knowledge Base</span>
                    <div className="h-px flex-1 bg-slate-800"></div>
                </div>

                <KnowledgeBaseSection challengeId={challengeId} />
            </div>
        </div>
        </RoleGuard>
    );
}
