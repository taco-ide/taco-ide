"use client";

import { KnowledgeBaseSection } from "@/components/challenge/knowledge-base-section";

interface StepKnowledgeBaseProps {
    challengeId: string;
    classroomId?: string;
}

export function StepKnowledgeBase({ challengeId, classroomId }: StepKnowledgeBaseProps) {
    return <KnowledgeBaseSection challengeId={challengeId} classroomId={classroomId} />;
}
