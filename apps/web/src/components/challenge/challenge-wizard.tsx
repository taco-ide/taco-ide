"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
    usePostV1Challenges,
    usePatchV1ChallengesId,
    getV1ChallengesQueryKey,
    getV1ChallengesIdQueryKey,
} from "@/kubb/hooks";
import { challengeFormSchema, type ChallengeFormData } from "@/components/challenge/schema";
import { WizardStepper } from "@/components/challenge/wizard-stepper";
import { StepBasicInfo } from "@/components/challenge/steps/step-basic-info";
import { StepDescription } from "@/components/challenge/steps/step-description";
import { StepKnowledgeBase } from "@/components/challenge/steps/step-knowledge-base";

const WIZARD_STEPS = [
    { label: "Informacoes Basicas" },
    { label: "Enunciado" },
    { label: "Knowledge Base" },
];

interface ChallengeWizardProps {
    mode: "create" | "edit";
    challengeId?: string;
    initialData?: ChallengeFormData;
    initialTags?: string[];
}

export function ChallengeWizard({ mode, challengeId, initialData, initialTags }: ChallengeWizardProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(0);
    const [tags, setTags] = useState<string[]>(initialTags ?? []);
    const [resolvedChallengeId, setResolvedChallengeId] = useState<string | null>(challengeId ?? null);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const methods = useForm<ChallengeFormData>({
        resolver: zodResolver(challengeFormSchema),
        defaultValues: initialData ?? {
            title: "",
            description: "",
            tags: [],
        },
    });

    const createMutation = usePostV1Challenges({
        mutation: {
            onSuccess: (res) => {
                queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
                setResolvedChallengeId(res.data.id);
                setCurrentStep(2);
            },
            onError: (err) => {
                setFeedback({
                    type: "error",
                    message: err.message ?? "Erro ao criar problema",
                });
            },
        },
    });

    const updateMutation = usePatchV1ChallengesId({
        mutation: {
            onSuccess: () => {
                if (challengeId) {
                    queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getV1ChallengesIdQueryKey(challengeId) });
                }
                setCurrentStep(2);
            },
            onError: (err) => {
                setFeedback({
                    type: "error",
                    message: err.message ?? "Erro ao atualizar problema",
                });
            },
        },
    });

    const isMutating = createMutation.isPending || updateMutation.isPending;

    const handleNext = async () => {
        setFeedback(null);

        if (currentStep === 0) {
            const valid = await methods.trigger(["title", "difficulty", "classroomId"]);
            if (!valid) return;
        }

        if (currentStep === 1) {
            const formData = methods.getValues();
            if (mode === "create" && !formData.classroomId) {
                methods.setError("classroomId", {
                    message: "Selecione uma turma",
                });
                return;
            }
            const payload = {
                title: formData.title,
                description: formData.description,
                difficulty: formData.difficulty,
                classroomId: formData.classroomId,
                tags: tags.length > 0 ? tags : undefined,
            };

            if (mode === "create") {
                createMutation.mutate({ data: payload });
            } else if (challengeId) {
                updateMutation.mutate({
                    id: challengeId,
                    data: {
                        title: formData.title,
                        description: formData.description ?? null,
                        difficulty: formData.difficulty,
                        tags: tags.length > 0 ? tags : null,
                    },
                });
            }
            return;
        }

        setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    };

    const handleBack = () => {
        setFeedback(null);
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const handleStepClick = (step: number) => {
        setFeedback(null);
        setCurrentStep(step);
    };

    const handleFinish = () => {
        router.push("/explore");
    };

    const isLastStep = currentStep === WIZARD_STEPS.length - 1;

    const effectiveChallengeId = resolvedChallengeId ?? challengeId;

    return (
        <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-12 text-center">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-3">
                        {mode === "create" ? "Create New Problem" : "Edit Problem"}
                    </h1>
                    <p className="text-slate-400 text-lg">
                        {mode === "create"
                            ? "Design your programming challenge with detailed instructions and resources"
                            : "Update your programming challenge"}
                    </p>
                </div>

                <WizardStepper
                    currentStep={currentStep}
                    steps={WIZARD_STEPS}
                    onStepClick={handleStepClick}
                />

                <FormProvider {...methods}>
                    <div className="space-y-6">
                        {currentStep === 0 && (
                            <StepBasicInfo tags={tags} setTags={setTags} />
                        )}
                        {currentStep === 1 && <StepDescription />}
                        {currentStep === 2 && effectiveChallengeId && (
                            <StepKnowledgeBase
                                challengeId={effectiveChallengeId}
                                classroomId={methods.getValues("classroomId")}
                            />
                        )}
                    </div>
                </FormProvider>

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

                <div className="mt-8 flex justify-between">
                    <div>
                        {currentStep > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors duration-200 flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Anterior
                            </Button>
                        )}
                    </div>
                    <div>
                        {isLastStep ? (
                            <Button
                                type="button"
                                onClick={handleFinish}
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium transition-all duration-200 flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Finalizar
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleNext}
                                disabled={isMutating}
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium transition-all duration-200 flex items-center gap-2"
                            >
                                {isMutating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="w-4 h-4" />
                                )}
                                Proximo
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
