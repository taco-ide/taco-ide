"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { X, Save, ShieldAlert, Loader2 } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { usePostV1Challenges, getV1ChallengesQueryKey } from "@/kubb/hooks";

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

const createChallengeSchema = z.object({
    title: z.string().min(1, "Titulo e obrigatorio").max(200),
    description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"], {
        required_error: "Selecione a dificuldade",
    }),
    tags: z.array(z.string()).optional(),
});

type CreateChallengeFormData = z.infer<typeof createChallengeSchema>;

function AccessDenied() {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
                <p className="text-slate-400">Apenas professores e coordenadores podem criar problemas.</p>
            </div>
        </div>
    );
}

export default function CreatePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [tags, setTags] = useState<string[]>([]);
    const [currentTag, setCurrentTag] = useState("");
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const mutation = usePostV1Challenges({
        mutation: {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
                router.push("/explore");
            },
            onError: (err) => {
                setFeedback({
                    type: "error",
                    message: err.message ?? "Erro ao criar problema",
                });
            },
        },
    });

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<CreateChallengeFormData>({
        resolver: zodResolver(createChallengeSchema),
        defaultValues: {
            title: "",
            description: "",
            tags: [],
        },
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

    const onSubmit = (data: CreateChallengeFormData) => {
        setFeedback(null);
        mutation.mutate({
            data: {
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                tags: tags.length > 0 ? tags : undefined,
            },
        });
    };

    return (
        <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-12 text-center">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-3">
                        Create New Problem
                    </h1>
                    <p className="text-slate-400 text-lg">Design your programming challenge with detailed instructions and resources</p>
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
                            Create Problem
                        </Button>
                    </div>
                </form>
            </div>
        </div>
        </RoleGuard>
    );
}
