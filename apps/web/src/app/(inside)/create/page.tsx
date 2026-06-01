"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ChallengeWizard } from "@/components/challenge/challenge-wizard";

function AccessDenied() {
    const t = useTranslations("create");
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">{t("accessDenied.title")}</h2>
                <p className="text-slate-400">{t("accessDenied.descriptionCreate")}</p>
            </div>
        </div>
    );
}

const CLASSROOM_NONE_VALUE = "__none__";

export default function CreatePage() {
    return (
        <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
            <ChallengeWizard mode="create" />
        </RoleGuard>
    );
}
