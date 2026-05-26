"use client";

import { useGetV1ChallengesChallengeidReferenceSolutions } from "@/kubb/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReferenceSolutionsPanelProps {
  challengeId: string;
}

export function ReferenceSolutionsPanel({
  challengeId,
}: ReferenceSolutionsPanelProps) {
  const { data: refSolsData } =
    useGetV1ChallengesChallengeidReferenceSolutions(challengeId);

  const refSolutions =
    refSolsData?.data?.filter((r) => r.status === "complete") ?? [];

  if (refSolutions.length === 0) {
    return (
      <div>
        <h2 className="text-slate-100 font-semibold mb-3">
          Soluções de referência
        </h2>
        <p className="text-slate-400 text-sm">
          Nenhuma solução de referência cadastrada.
        </p>
      </div>
    );
  }

  if (refSolutions.length === 1) {
    const sol = refSolutions[0];
    const kindLabel =
      sol.kind === "brute_force" ? "Brute Force" : "Refinada";
    return (
      <div>
        <h2 className="text-slate-100 font-semibold mb-3">
          Solução de referência — {kindLabel}
        </h2>
        <pre className="bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
          {sol.code ?? "(sem código)"}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-slate-100 font-semibold mb-3">
        Soluções de referência
      </h2>
      <Tabs defaultValue={refSolutions[0]?.kind ?? "brute_force"}>
        <TabsList className="bg-slate-800 border border-slate-700">
          {refSolutions.map((sol) => (
            <TabsTrigger
              key={sol.kind}
              value={sol.kind}
              className="data-[state=active]:bg-slate-700"
            >
              {sol.kind === "brute_force" ? "Brute Force" : "Refinada"}
            </TabsTrigger>
          ))}
        </TabsList>
        {refSolutions.map((sol) => (
          <TabsContent key={sol.kind} value={sol.kind}>
            <pre className="bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
              {sol.code ?? "(sem código)"}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
