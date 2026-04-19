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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-[1920px] p-4 pb-8 flex flex-col gap-4 min-h-screen">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

        {replay.totalSteps === 0 ? (
          <p className="text-sm text-slate-500 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
            Esta sessão ainda não tem interações registadas.
          </p>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:min-h-0 lg:flex-1 lg:items-stretch lg:min-h-[min(720px,calc(100vh-220px))]">
          <div className="flex min-h-[320px] flex-col lg:min-h-0 lg:h-full lg:max-h-[calc(100vh-220px)]">
            <ReplayIOPanel
              stdin={replay.derived.stdin}
              stdout={replay.derived.stdout}
              animationsEnabled={replay.animationsEnabled}
            />
          </div>
          <div className="flex min-h-[320px] flex-col lg:min-h-0 lg:h-full lg:max-h-[calc(100vh-220px)]">
            <ReplayChatColumn
              interactions={interactions}
              stepIndex={replay.stepIndex}
              stepDirection={replay.stepDirection}
              animationsEnabled={replay.animationsEnabled}
              derived={replay.derived}
            />
          </div>
          <div className="flex min-h-[320px] flex-col lg:min-h-0 lg:h-full lg:max-h-[calc(100vh-220px)]">
            <ReplayCodeColumn code={replay.derived.code} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkSessionReplayPage() {
  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <ReplayContent />
    </RoleGuard>
  );
}
