"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useGetV1WorkSessionsId } from "@/kubb/hooks";
import { ApiError } from "@/lib/apiClient";
import { ReplayToolbar } from "./_components/ReplayToolbar";
import { ReplayIOPanel } from "./_components/ReplayIOPanel";
import { ReplayChatColumn } from "./_components/ReplayChatColumn";
import { ReplayCodeColumn } from "./_components/ReplayCodeColumn";
import { useWorkSessionReplay } from "./_components/useWorkSessionReplay";
import type { ReplayInteraction } from "./_components/deriveReplayState";

function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-slate-400">
        Acesso restrito a professores e coordenadores.
      </p>
    </div>
  );
}

function ReplayContent() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;
  const sessionId = params.sessionId as string;

  const { data, isPending, isError, error } = useGetV1WorkSessionsId(
    sessionId,
    {
      query: { enabled: !!sessionId },
    }
  );

  const interactions = useMemo((): ReplayInteraction[] => {
    const raw = data?.data?.interactions;
    if (!raw) return [];
    return raw.map((i) => ({
      id: i.id,
      interactionType: i.interactionType,
      userPrompt: i.userPrompt,
      modelResponse: i.modelResponse,
      code: i.code,
      stdin: i.stdin,
      stdout: i.stdout,
      createdAt: i.createdAt,
    }));
  }, [data?.data?.interactions]);

  const replay = useWorkSessionReplay(interactions);

  const errorMessage = useMemo(() => {
    if (!isError || !error) return null;
    if (error instanceof ApiError) return error.message;
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message);
    }
    return "Não foi possível carregar a sessão.";
  }, [isError, error]);

  const backHref = `/create/${challengeId}/work-sessions`;

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
        <p className="text-sm text-slate-400">A carregar sessão…</p>
      </div>
    );
  }

  if (isError && errorMessage) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-6 border-slate-600 bg-slate-800 text-slate-200"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar à lista
        </Button>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm max-w-lg">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-600 bg-slate-800 text-slate-200"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à lista
          </Button>
          {data?.data?.id ? (
            <p className="text-xs text-slate-500 font-mono truncate max-w-[min(100%,280px)]">
              Sessão {data.data.id}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
        <ReplayToolbar
          stepIndex={replay.stepIndex}
          totalInteractions={replay.totalSteps}
          isPlaying={replay.isPlaying}
          animationsEnabled={replay.animationsEnabled}
          onAnimationsEnabledChange={replay.setAnimationsEnabled}
          canPrev={replay.canPrev}
          canNext={replay.canNext}
          canPlay={replay.canPlay}
          onGoStart={replay.goStart}
          onGoEnd={replay.goEnd}
          onStepPrev={replay.stepPrev}
          onStepNext={replay.stepNext}
          onTogglePlay={replay.togglePlay}
          lastInteractionAt={replay.derived.lastInteractionAt}
        />
        </div>

        {replay.totalSteps === 0 ? (
          <p className="shrink-0 text-sm text-slate-500 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
            Esta sessão ainda não tem interações registadas.
          </p>
        ) : null}

        {/* flex-1 + min-h-0: coluna do chat não empurra a página; scroll só dentro do log em ReplayChatColumn */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:grid lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1 lg:items-stretch lg:gap-4">
          <div className="flex min-h-[min(32vh,260px)] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:h-full lg:max-h-full">
            <ReplayIOPanel
              stdin={replay.derived.stdin}
              stdout={replay.derived.stdout}
              animationsEnabled={replay.animationsEnabled}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0 lg:h-full lg:max-h-full">
            <ReplayChatColumn
              interactions={interactions}
              stepIndex={replay.stepIndex}
              stepDirection={replay.stepDirection}
              animationsEnabled={replay.animationsEnabled}
              derived={replay.derived}
            />
          </div>
          <div className="flex min-h-[min(32vh,260px)] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:h-full lg:max-h-full">
            <ReplayCodeColumn
              code={replay.derived.code}
              stepIndex={replay.stepIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkSessionReplayPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
        <ReplayContent />
      </RoleGuard>
    </div>
  );
}
