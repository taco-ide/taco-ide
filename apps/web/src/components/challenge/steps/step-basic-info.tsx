"use client";

import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Lightbulb, Plus, X } from "lucide-react";
import { difficultyLevels } from "@/components/challenge/constants";
import type { ChallengeFormData } from "@/components/challenge/schema";
import {
    useGetV1Classrooms,
    usePostV1Classrooms,
    getV1ClassroomsQueryKey,
} from "@/kubb/hooks";
import { useUser } from "@/contexts/UserContext";

const CREATE_NEW_VALUE = "__create_new__";

interface StepBasicInfoProps {
    tags: string[];
    setTags: (tags: string[]) => void;
}

export function StepBasicInfo({ tags, setTags }: StepBasicInfoProps) {
    const t = useTranslations("challenge");
    const c = useTranslations("common");
    const [currentTag, setCurrentTag] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [newClassroomTitle, setNewClassroomTitle] = useState("");

    const { user } = useUser();
    const queryClient = useQueryClient();

    const {
        register,
        control,
        setValue,
        formState: { errors },
    } = useFormContext<ChallengeFormData>();

    const { data: classroomsData, isLoading: isLoadingClassrooms } = useGetV1Classrooms(
        { scope: "org", perPage: 100 },
    );

    const classrooms = classroomsData?.data ?? [];

    const createClassroomMutation = usePostV1Classrooms({
        mutation: {
            onSuccess: (res) => {
                queryClient.invalidateQueries({ queryKey: getV1ClassroomsQueryKey() });
                setValue("classroomId", res.data.id);
                setIsCreating(false);
                setNewClassroomTitle("");
            },
        },
    });

    const handleSelectChange = (value: string, fieldOnChange: (...event: unknown[]) => void) => {
        if (value === CREATE_NEW_VALUE) {
            setIsCreating(true);
            return;
        }

        fieldOnChange(value);
    };

    const handleCreateClassroom = () => {
        const title = newClassroomTitle.trim();
        if (!title || !user?.activeOrganizationId) return;

        createClassroomMutation.mutate({
            data: {
                title,
                organizationId: user.activeOrganizationId,
            },
        });
    };

    const handleCancelCreate = () => {
        setIsCreating(false);
        setNewClassroomTitle("");
    };

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

    return (
        <Card className="p-6 bg-slate-800 border-slate-700">
            <div className="space-y-4">
                <Alert className="border-amber-500/35 bg-amber-500/10 text-amber-100 [&>svg]:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle className="text-amber-100">
                        {t("basicInfo.hint.title")}
                    </AlertTitle>
                    <AlertDescription className="text-amber-100/90 space-y-2">
                        <ul className="list-disc pl-4 space-y-1.5 text-sm">
                            <li>
                                {t.rich("basicInfo.hint.titleTags", {
                                    strong: (chunks) => (
                                        <strong className="text-amber-50">{chunks}</strong>
                                    ),
                                })}
                            </li>
                            <li>
                                {t.rich("basicInfo.hint.difficulty", {
                                    strong: (chunks) => (
                                        <strong className="text-amber-50">{chunks}</strong>
                                    ),
                                })}
                            </li>
                            <li>
                                {t.rich("basicInfo.hint.classroom", {
                                    strong: (chunks) => (
                                        <strong className="text-amber-50">{chunks}</strong>
                                    ),
                                    em: (chunks) => <em>{chunks}</em>,
                                })}
                            </li>
                        </ul>
                        <p className="text-xs text-amber-200/80 pt-1">
                            {t("basicInfo.hint.example")}
                        </p>
                    </AlertDescription>
                </Alert>

                <div>
                    <Label className="text-slate-200">{t("basicInfo.title.label")}</Label>
                    <Input
                        {...register("title")}
                        placeholder={t("basicInfo.title.placeholder")}
                        className="bg-slate-900 border-slate-700 text-slate-200"
                    />
                    {errors.title && (
                        <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>
                    )}
                </div>

                <div>
                    <Label className="text-slate-200">{t("basicInfo.difficulty.label")}</Label>
                    <Controller
                        control={control}
                        name="difficulty"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                    <SelectValue placeholder={t("basicInfo.difficulty.placeholder")} />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    {difficultyLevels.map((level) => (
                                        <SelectItem
                                            key={level.value}
                                            value={level.value}
                                            className="text-slate-200 focus:bg-slate-700"
                                        >
                                            {t(`basicInfo.difficulty.options.${level.value}`)}
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
                    <Label className="text-slate-200">{t("basicInfo.classroom.label")}</Label>
                    {isCreating ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={newClassroomTitle}
                                onChange={(e) => setNewClassroomTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleCreateClassroom();
                                    }
                                    if (e.key === "Escape") {
                                        handleCancelCreate();
                                    }
                                }}
                                placeholder={t("basicInfo.classroom.newPlaceholder")}
                                className="bg-slate-900 border-slate-700 text-slate-200 flex-1"
                                autoFocus
                                disabled={createClassroomMutation.isPending}
                            />
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleCreateClassroom}
                                disabled={!newClassroomTitle.trim() || createClassroomMutation.isPending}
                                className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-medium"
                            >
                                {createClassroomMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    c("create")
                                )}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCancelCreate}
                                disabled={createClassroomMutation.isPending}
                                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                            >
                                {c("cancel")}
                            </Button>
                        </div>
                    ) : (
                        <Controller
                            control={control}
                            name="classroomId"
                            render={({ field }) => (
                                <Select
                                    onValueChange={(value: string) => handleSelectChange(value, field.onChange)}
                                    value={field.value ?? ""}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                        <SelectValue
                                            placeholder={
                                                isLoadingClassrooms
                                                    ? t("basicInfo.classroom.loading")
                                                    : t("basicInfo.classroom.placeholder")
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        {classrooms.map((classroom) => (
                                            <SelectItem
                                                key={classroom.id}
                                                value={classroom.id}
                                                className="text-slate-200 focus:bg-slate-700"
                                            >
                                                {classroom.title}
                                            </SelectItem>
                                        ))}
                                        <SelectItem
                                            value={CREATE_NEW_VALUE}
                                            className="text-yellow-400 focus:bg-slate-700"
                                        >
                                            <span className="flex items-center gap-1">
                                                <Plus className="w-3 h-3" />
                                                {t("basicInfo.classroom.createNew")}
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    )}
                    {errors.classroomId && (
                        <p className="text-red-400 text-sm mt-1">{errors.classroomId.message}</p>
                    )}
                    {createClassroomMutation.isError && (
                        <p className="text-red-400 text-sm mt-1">
                            {t("basicInfo.classroom.createError")}
                        </p>
                    )}
                </div>

                <div>
                    <Label className="text-slate-200">{t("basicInfo.tags.label")}</Label>
                    <div className="space-y-2">
                        <Input
                            value={currentTag}
                            onChange={(e) => setCurrentTag(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder={t("basicInfo.tags.placeholder")}
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
            </div>
        </Card>
    );
}
