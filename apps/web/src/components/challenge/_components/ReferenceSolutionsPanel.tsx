"use client";

import {
  useGetV1ChallengesChallengeidReferenceSolutions,
  usePostV1ChallengesChallengeidReferenceSolutionsKindRegenerate,
  getV1ChallengesChallengeidReferenceSolutionsQueryKey,
} from "@/kubb/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

interface ReferenceSolutionsPanelProps {
  challengeId: string;
}

const REGEN_KINDS = ["brute_force", "refined"] as const;

function EmptyReferenceSolutions({ challengeId }: { challengeId: string }) {
  const t = useTranslations("challenge");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } =
    usePostV1ChallengesChallengeidReferenceSolutionsKindRegenerate();

  const handleGenerate = async () => {
    setError(null);
    try {
      // Generate both kinds; the endpoint creates the row when absent.
      for (const kind of REGEN_KINDS) {
        await mutateAsync({ challengeId, kind });
      }
      queryClient.invalidateQueries({
        queryKey:
          getV1ChallengesChallengeidReferenceSolutionsQueryKey(challengeId),
      });
    } catch (err: any) {
      setError(err?.message || t("referenceSolutions.panel.generateError"));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-slate-100 font-semibold">
          {t("referenceSolutions.title")}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-600 bg-slate-800 text-slate-200"
          onClick={handleGenerate}
          disabled={isPending}
          title={t("referenceSolutions.panel.generateTitle")}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="ml-1.5">{t("referenceSolutions.panel.generate")}</span>
        </Button>
      </div>

      {error ? (
        <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300 mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-slate-400 text-sm">
        {t("referenceSolutions.panel.emptyList")}
      </p>
    </div>
  );
}

type RefSolution = {
  kind: string;
  status: string;
  code: string | null;
  error: string | null;
};

function SolutionBody({ sol }: { sol: RefSolution }) {
  const t = useTranslations("challenge");
  if (sol.status === "complete") {
    return (
      <pre className="bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
        {sol.code ?? t("referenceSolutions.panel.noCode")}
      </pre>
    );
  }
  if (sol.status === "running") {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm italic p-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("referenceSolutions.running")}
      </div>
    );
  }
  if (sol.status === "failed") {
    return (
      <div className="border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm rounded p-3">
        <span className="font-medium">{t("referenceSolutions.panel.failedLabel")}</span>{" "}
        {sol.error ? sol.error.slice(0, 200) : t("referenceSolutions.panel.unknownError")}
      </div>
    );
  }
  // pending or unknown
  return (
    <p className="text-amber-400/90 text-sm p-3">
      {t("referenceSolutions.panel.pendingAwaiting")}
    </p>
  );
}

export function ReferenceSolutionsPanel({
  challengeId,
}: ReferenceSolutionsPanelProps) {
  const t = useTranslations("challenge");
  const { data: refSolsData } =
    useGetV1ChallengesChallengeidReferenceSolutions(challengeId);

  const refSolutions = refSolsData?.data ?? [];

  const kindLabel = (kind: string) =>
    kind === "brute_force"
      ? t("referenceSolutions.kind.brute_force")
      : t("referenceSolutions.kind.refined");

  if (refSolutions.length === 0) {
    return <EmptyReferenceSolutions challengeId={challengeId} />;
  }

  if (refSolutions.length === 1) {
    const sol = refSolutions[0];
    return (
      <div>
        <h2 className="text-slate-100 font-semibold mb-3">
          {t("referenceSolutions.panel.singleTitle", { kind: kindLabel(sol.kind) })}
        </h2>
        <SolutionBody sol={sol} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-slate-100 font-semibold mb-3">
        {t("referenceSolutions.title")}
      </h2>
      <Tabs defaultValue={refSolutions[0]?.kind ?? "brute_force"}>
        <TabsList className="bg-slate-800 border border-slate-700">
          {refSolutions.map((sol) => (
            <TabsTrigger
              key={sol.kind}
              value={sol.kind}
              className="data-[state=active]:bg-slate-700"
            >
              {kindLabel(sol.kind)}
              {sol.status !== "complete" && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-slate-400">
                  · {sol.status}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {refSolutions.map((sol) => (
          <TabsContent key={sol.kind} value={sol.kind}>
            <SolutionBody sol={sol} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
