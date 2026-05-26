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
    getV1ChallengesChallengeidReferenceSolutionsQueryOptions,
} from "@/kubb/hooks";
import { challengeFormSchema, type ChallengeFormData } from "@/components/challenge/schema";
import { WizardStepper } from "@/components/challenge/wizard-stepper";
import { StepBasicInfo } from "@/components/challenge/steps/step-basic-info";
import { StepDescription } from "@/components/challenge/steps/step-description";
import { StepReferenceSolutions } from "@/components/challenge/steps/step-reference-solutions";
import { StepKnowledgeBase } from "@/components/challenge/steps/step-knowledge-base";

const WIZARD_STEPS = [
    { label: "Informações Básicas" },
    { label: "Enunciado" },
    { label: "Soluções de referência" },
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
    const [hasSavedRefStep, setHasSavedRefStep] = useState(false);
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
            generateReferenceSolutions: true,
        },
    });

    const createMutation = usePostV1Challenges({
        mutation: {
            onSuccess: (res) => {
                queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
                setResolvedChallengeId(res.data.id);
                setHasSavedRefStep(true);
                // Clear isDirty so a second "Próximo" click just advances.
                methods.reset(methods.getValues());
                setFeedback({
                    type: "success",
                    message:
                        "Desafio salvo. Soluções de referência sendo geradas em segundo plano — acompanhe abaixo ou avance para a próxima etapa.",
                });
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
                setHasSavedRefStep(true);
                const willGenerate =
                    methods.getValues("generateReferenceSolutions") === true;
                methods.reset(methods.getValues());
                setFeedback({
                    type: "success",
                    message: willGenerate
                        ? "Alterações salvas. Soluções de referência sendo geradas em segundo plano — acompanhe abaixo ou avance para a próxima etapa."
                        : "Alterações salvas. Você pode avançar para a próxima etapa.",
                });
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
            const valid = await methods.trigger(["description"]);
            if (!valid) return;
            // Save happens on step 2 so the user can toggle
            // generateReferenceSolutions before the mutation fires.
            setCurrentStep(2);
            return;
        }

        if (currentStep === 2) {
            // Two-phase Próximo on step 2: first click saves, second click
            // advances. Generation status is shown in StepReferenceSolutions
            // and never blocks moving forward — KB doesn't depend on it.
            const savedChallengeId = resolvedChallengeId ?? challengeId;
            if (
                hasSavedRefStep &&
                !methods.formState.isDirty &&
                savedChallengeId
            ) {
                setCurrentStep(3);
                return;
            }

            const formData = methods.getValues();
            if (mode === "create" && !formData.classroomId) {
                methods.setError("classroomId", {
                    message: "Selecione uma turma",
                });
                setCurrentStep(0);
                return;
            }

            // Manual-override confirmation guard. fetchQuery (not
            // getQueryData) so a slow first-load doesn't silently bypass
            // the dialog and clobber a teacher's manual edits.
            if (
                mode === "edit" &&
                formData.generateReferenceSolutions === true &&
                effectiveChallengeId
            ) {
                try {
                    const fresh = await queryClient.fetchQuery(
                        getV1ChallengesChallengeidReferenceSolutionsQueryOptions(
                            effectiveChallengeId
                        )
                    );
                    const existingRefs =
                        (fresh as { data?: { createdBy?: string }[] } | undefined)
                            ?.data ?? [];
                    const hasManualRefs = existingRefs.some(
                        (r) => r.createdBy === "manual"
                    );
                    if (
                        hasManualRefs &&
                        !window.confirm(
                            "Isso vai substituir soluções editadas manualmente. Continuar?"
                        )
                    ) {
                        return;
                    }
                } catch {
                    // If we can't read current refs, fall through and save —
                    // the server still enforces auth + cooldown.
                }
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                difficulty: formData.difficulty,
                classroomId: formData.classroomId,
                tags: tags.length > 0 ? tags : undefined,
                generateReferenceSolutions: formData.generateReferenceSolutions !== false ? true : undefined,
            };

            if (mode === "create") {
                createMutation.mutate({ data: payload });
            } else if (challengeId) {
                const patchData: any = {
                    title: formData.title,
                    description: formData.description ?? null,
                    difficulty: formData.difficulty,
                    tags: tags.length > 0 ? tags : null,
                };
                if (formData.generateReferenceSolutions === true) {
                    patchData.generateReferenceSolutions = true;
                }
                updateMutation.mutate({
                    id: challengeId,
                    data: patchData,
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
        // In create mode, KB (step 3) is unreachable until the challenge
        // has been saved on step 2 (resolvedChallengeId is set). Block
        // forward jumps that would skip the save step entirely.
        if (mode === "create" && step > 2 && !resolvedChallengeId) {
            return;
        }
        setCurrentStep(step);
    };

    const handleFinish = () => {
        router.push("/explore");
    };

    const isLastStep = currentStep === WIZARD_STEPS.length - 1;

    const effectiveChallengeId = resolvedChallengeId ?? challengeId;

    // Destructure to subscribe react-hook-form's formState proxy.
    const { isDirty } = methods.formState;
    const showAdvanceLabelOnStep2 =
        currentStep === 2 && hasSavedRefStep && !isDirty && !!effectiveChallengeId;

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
                        {currentStep === 2 && (
                            <StepReferenceSolutions
                                challengeId={effectiveChallengeId ?? undefined}
                                mode={mode}
                            />
                        )}
                        {currentStep === 3 && effectiveChallengeId && (
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
                                {showAdvanceLabelOnStep2
                                    ? "Continuar para Knowledge Base"
                                    : "Próximo"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
