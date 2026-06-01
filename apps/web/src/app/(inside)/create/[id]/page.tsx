"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ChallengeWizard } from "@/components/challenge/challenge-wizard";
import { useGetV1ChallengesId } from "@/kubb/hooks";

function AccessDenied() {
    const t = useTranslations("create");
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">{t("accessDenied.title")}</h2>
                <p className="text-slate-400">{t("accessDenied.descriptionEdit")}</p>
            </div>
        </div>
    );
}

export default function EditChallengePage() {
    const params = useParams();
    const router = useRouter();
    const t = useTranslations("create");
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
                    <h2 className="text-2xl font-bold text-white">{t("notFound.title")}</h2>
                    <p className="text-slate-400">
                        {error instanceof Error ? error.message : t("notFound.description")}
                    </p>
                    <Button
                        onClick={() => router.push("/explore")}
                        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
                    >
                        {t("notFound.backToExplore")}
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
