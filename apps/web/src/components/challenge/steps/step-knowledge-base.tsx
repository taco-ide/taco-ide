"use client";

import { KnowledgeBaseSection } from "@/components/challenge/knowledge-base-section";

interface StepKnowledgeBaseProps {
    challengeId: string;
}

export function StepKnowledgeBase({ challengeId }: StepKnowledgeBaseProps) {
    return <KnowledgeBaseSection challengeId={challengeId} />;
}
