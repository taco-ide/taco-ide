"use client";

import { useRef, useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRemark } from "react-remark";
import { Text, Lightbulb } from "lucide-react";
import type { ChallengeFormData } from "@/components/challenge/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function StepDescription() {
    const t = useTranslations("challenge");
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
        <div className="space-y-6">
            <Alert className="border-amber-500/35 bg-amber-500/10 text-amber-100 [&>svg]:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle className="text-amber-100">{t("description.hint.title")}</AlertTitle>
                <AlertDescription className="text-amber-100/90 space-y-2 text-sm">
                    <p>{t("description.hint.body")}</p>
                    <p className="text-xs text-amber-200/85 border-l-2 border-amber-400/40 pl-3 my-2">
                        {t("description.hint.example")}
                    </p>
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6 items-stretch h-[360px]">
            <Card className="p-6 bg-slate-800 border-slate-700 flex flex-col h-full">
                <div className="flex flex-col flex-1 min-h-0 space-y-2">
                    <Label className="text-slate-200">{t("description.label")}</Label>
                    <Textarea
                        {...restRegister}
                        placeholder={t("description.placeholder")}
                        className="flex-1 min-h-0 resize-none bg-slate-900 border-slate-700 text-slate-200"
                        onChange={(e) => {
                            rhfOnChange(e);
                            handleMarkdownChange(e.currentTarget.value);
                        }}
                    />
                </div>
            </Card>
            <Card className="bg-[#1a1f2e] text-white flex flex-col h-full min-h-0">
                <CardHeader className="py-3">
                    <CardTitle>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50">
                                    <Text className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-300">{t("description.previewTitle")}</span>
                            </div>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                    <ScrollArea className="w-full h-full">
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
