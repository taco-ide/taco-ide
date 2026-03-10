"use client";

import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
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
import { X } from "lucide-react";
import { difficultyLevels } from "@/components/challenge/constants";
import type { ChallengeFormData } from "@/components/challenge/schema";

interface StepBasicInfoProps {
    tags: string[];
    setTags: (tags: string[]) => void;
}

export function StepBasicInfo({ tags, setTags }: StepBasicInfoProps) {
    const [currentTag, setCurrentTag] = useState("");
    const {
        register,
        control,
        formState: { errors },
    } = useFormContext<ChallengeFormData>();

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
            </div>
        </Card>
    );
}
