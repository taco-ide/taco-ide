"use client";

import { useRef, useCallback, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRemark } from "react-remark";
import { Text, Lightbulb } from "lucide-react";
import type { ChallengeFormData } from "@/components/challenge/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
        <div className="space-y-6">
            <Alert className="border-amber-500/35 bg-amber-500/10 text-amber-100 [&>svg]:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle className="text-amber-100">Enunciado que o aluno lê na aba Problema</AlertTitle>
                <AlertDescription className="text-amber-100/90 space-y-2 text-sm">
                    <p>
                        Tudo que você escrever aqui (Markdown) é o texto principal do exercício. Boas práticas: contexto
                        em 1–2 frases, formato de entrada e saída, exemplos, e restrições quando houver.
                    </p>
                    <p className="text-xs text-amber-200/85 border-l-2 border-amber-400/40 pl-3 my-2">
                        Exemplo (ilustrativo): &quot;Leia dois inteiros e imprima a soma.&quot; + bloco com exemplo de
                        entrada/saída.
                    </p>
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6 items-stretch h-[360px]">
            <Card className="p-6 bg-slate-800 border-slate-700 flex flex-col h-full">
                <div className="flex flex-col flex-1 min-h-0 space-y-2">
                    <Label className="text-slate-200">Problem Description</Label>
                    <Textarea
                        {...restRegister}
                        placeholder="Type the problem text here... Markdown supported"
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
                                <span className="text-sm font-medium text-gray-300">Problem Description Preview</span>
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
