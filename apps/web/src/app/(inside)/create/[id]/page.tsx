"use client";

import { useParams , useRouter } from "next/navigation";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ChallengeWizard } from "@/components/challenge/challenge-wizard";
import { useGetV1ChallengesId } from "@/kubb/hooks";

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

export default function EditChallengePage() {
    const params = useParams();
    const router = useRouter();
    const challengeId = params.id as string;

    const { data: challengeData, isLoading, error } = useGetV1ChallengesId(challengeId);
    const challenge = challengeData?.data;

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
            <ChallengeWizard
                mode="edit"
                challengeId={challengeId}
                initialData={{
                    title: challenge.title,
                    description: challenge.description ?? "",
                    difficulty: (challenge.difficulty as "easy" | "medium" | "hard") ?? "easy",
                    classroomId: (challenge as Record<string, unknown>).classroomId as string ?? "",
                    tags: challenge.tags ?? [],
                }}
                initialTags={challenge.tags ?? []}
            />
        </RoleGuard>
    );
}
