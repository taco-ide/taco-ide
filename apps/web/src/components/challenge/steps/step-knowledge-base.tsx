"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { KnowledgeBaseSection } from "@/components/challenge/knowledge-base-section";

interface StepKnowledgeBaseProps {
    challengeId: string;
}

export function StepKnowledgeBase({ challengeId }: StepKnowledgeBaseProps) {
    const { control } = useFormContext();
    const classroomId = useWatch({ control, name: "classroomId" });
    return (
        <KnowledgeBaseSection
            challengeId={challengeId}
            classroomId={classroomId || undefined}
        />
    );
}
