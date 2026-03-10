"use client";

import { ShieldAlert } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ChallengeWizard } from "@/components/challenge/challenge-wizard";

function AccessDenied() {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
                <p className="text-slate-400">Apenas professores e coordenadores podem criar problemas.</p>
            </div>
        </div>
    );
}

export default function CreatePage() {
    return (
        <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
            <ChallengeWizard mode="create" />
        </RoleGuard>
    );
}
