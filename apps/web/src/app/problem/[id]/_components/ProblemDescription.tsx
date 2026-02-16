"use client";

import { useProblem } from "@/contexts/ProblemContext";
import { useRemarkSync } from "react-remark";

function ProblemDescription() {
  const { challenge } = useProblem();

  const problemDescription = challenge?.description
    ? `# ${challenge.title}\n\n${challenge.description}`
    : `# Carregando...\n\nAguarde enquanto carregamos a descrição do problema.`;

  const reactContent = useRemarkSync(problemDescription);

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="p-4 pr-5">
        <div className="prose prose-sm prose-invert max-w-none prose-p:text-zinc-400 prose-headings:text-zinc-200 prose-code:text-amber-400/90 prose-pre:bg-zinc-800/60 prose-pre:border prose-pre:border-zinc-700/50">
          {reactContent}
        </div>
      </div>
    </div>
  );
}

export default ProblemDescription;
