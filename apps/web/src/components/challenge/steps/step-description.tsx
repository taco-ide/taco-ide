"use client";

import { useRef, useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRemark } from "react-remark";
import { Text } from "lucide-react";
import type { ChallengeFormData } from "@/components/challenge/schema";

export function StepDescription() {
    const { register, watch } = useFormContext<ChallengeFormData>();
    const [reactContent, setMarkdownSource] = useRemark();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const descriptionValue = watch("description");

    // Sync initial value to markdown preview
    useEffect(() => {
        if (descriptionValue) {
            setMarkdownSource(descriptionValue);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMarkdownChange = useCallback(
        (value: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                setMarkdownSource(value);
            }, 300);
        },
        [setMarkdownSource],
    );

    const { onChange: rhfOnChange, ...restRegister } = register("description");

    return (
        <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
                <Card className="p-6 bg-slate-800 border-slate-700">
                    <div className="space-y-4">
                        <Label className="text-slate-200">Problem Description</Label>
                        <Textarea
                            {...restRegister}
                            placeholder="Type the problem text here... Markdown supported"
                            className="min-h-[500px] bg-slate-900 border-slate-700 text-slate-200"
                            onChange={(e) => {
                                rhfOnChange(e);
                                handleMarkdownChange(e.currentTarget.value);
                            }}
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
    );
}
