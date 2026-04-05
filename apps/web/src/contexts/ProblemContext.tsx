"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetV1ChallengesId,
  useGetV1ChallengesIdSolution,
  useGetV1WorkSessionsByChallenge,
  useGetV1WorkSessionsId,
  usePostV1WorkSessions,
  usePutV1ChallengesIdSolution,
  usePostV1WorkSessionsIdInteractions,
  usePostV1WorkSessionsIdChat,
  usePostV1WorkSessionsIdSubmit,
  usePostV1WorkSessionsIdReopen,
  useDeleteV1WorkSessionsIdReset,
  getV1WorkSessionsByChallengeQueryKey,
  getV1WorkSessionsByChallengeQueryOptions,
  getV1WorkSessionsIdQueryKey,
  getV1WorkSessionsIdQueryOptions,
  getV1ChallengesIdSolutionQueryKey,
} from "@/kubb/hooks";
import { ApiError } from "@/lib/apiClient";
import { useCodeEditorStore } from "@/store/useCodeEditorStore";

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  tags: string[];
  supportMaterials: unknown;
  author: string | null;
  classroomTitle: string | null;
  teachingAssistants: { id: string; alias: string; isDefault: boolean }[];
};

export type WorkSession = {
  id: string;
  challengeId: string;
  teachingAssistantId: string;
  endedAt: string | null;
  interactions: {
    id: string;
    interactionType: string;
    userPrompt: string;
    modelResponse: string;
    code: string | null;
    stdin: string | null;
    stdout: string | null;
    createdAt: string;
  }[];
};

export type Solution = {
  id: string;
  code: string | null;
  stdin: string | null;
  stdout: string | null;
  chatHistory: unknown;
  updatedAt: string;
};

type ProblemContextValue = {
  challengeId: string | null;
  challenge: Challenge | null;
  workSession: WorkSession | null;
  solution: Solution | null;
  isSessionEnded: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveSolution: (data: { code?: string; stdin?: string; stdout?: string }) => Promise<void>;
  addInteraction: (data: {
    interactionType: "chat" | "code_run";
    userPrompt?: string;
    modelResponse?: string;
    code?: string;
    stdin?: string;
    stdout?: string;
  }) => Promise<void>;
  sendChatMessage: (params: {
    message: string;
    code?: string;
    stdin?: string;
    stdout?: string;
  }) => Promise<{ modelResponse: string }>;
  submitWorkSession: () => Promise<void>;
  reopenWorkSession: () => Promise<void>;
  resetWorkSession: () => Promise<void>;
};

const ProblemContext = createContext<ProblemContextValue | null>(null);

function is404(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Logs de diagnóstico da sessão (dev ou NEXT_PUBLIC_DEBUG_WORK_SESSION=1). */
const WS_DEBUG =
  process.env.NEXT_PUBLIC_DEBUG_WORK_SESSION === "1" ||
  process.env.NODE_ENV !== "production";

function logWs(label: string, payload?: Record<string, unknown>) {
  if (!WS_DEBUG) return;
  if (payload && Object.keys(payload).length > 0) {
    console.log(`[ProblemContext:workSession] ${label}`, payload);
  } else {
    console.log(`[ProblemContext:workSession] ${label}`);
  }
}

function logWsError(label: string, err: unknown) {
  if (!WS_DEBUG) return;
  const extra =
    err instanceof ApiError
      ? { message: err.message, status: err.status, name: err.name }
      : err instanceof Error
        ? { message: err.message, name: err.name }
        : { value: String(err) };
  console.warn(`[ProblemContext:workSession] ${label}`, extra, err);
}

function mapWorkSession(raw: {
  id: string;
  challengeId: string;
  teachingAssistantId: string;
  endedAt: string | null;
  interactions: WorkSession["interactions"];
}): WorkSession {
  return {
    id: raw.id,
    challengeId: raw.challengeId,
    teachingAssistantId: raw.teachingAssistantId,
    endedAt: raw.endedAt ?? null,
    interactions: raw.interactions.map((i) => ({
      id: i.id,
      interactionType: i.interactionType,
      userPrompt: i.userPrompt,
      modelResponse: i.modelResponse,
      code: i.code,
      stdin: i.stdin,
      stdout: i.stdout,
      createdAt: i.createdAt,
    })),
  };
}

export function ProblemProvider({
  challengeId,
  children,
}: {
  challengeId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const challengeQuery = useGetV1ChallengesId(challengeId, {
    query: { enabled: !!challengeId },
  });

  const solutionQuery = useGetV1ChallengesIdSolution(challengeId, {
    query: { enabled: !!challengeId, retry: false },
  });

  const byChallengeQuery = useGetV1WorkSessionsByChallenge(
    { challengeId },
    {
      query: {
        enabled: !!challengeId,
        // Sem sessão ainda: API devolve 200 com data null (não 404), para não poluir a consola do browser.
        retry: false,
      },
    }
  );

  const sessionId =
    byChallengeQuery.data?.data?.id ?? createdSessionId;

  const fullSessionQuery = useGetV1WorkSessionsId(sessionId ?? "", {
    query: { enabled: !!sessionId },
  });

  const createSessionMutation = usePostV1WorkSessions({
    mutation: {
      onSuccess: (response) => {
        setCreatedSessionId(response.data.id);
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsByChallengeQueryKey({ challengeId }),
        });
      },
    },
  });

  const putSolutionMutation = usePutV1ChallengesIdSolution({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesIdSolutionQueryKey(challengeId),
        });
      },
    },
  });

  const addInteractionMutation = usePostV1WorkSessionsIdInteractions({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsIdQueryKey(variables.id),
        });
      },
    },
  });

  const chatMutation = usePostV1WorkSessionsIdChat({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsIdQueryKey(variables.id),
        });
      },
    },
  });

  const submitMutation = usePostV1WorkSessionsIdSubmit({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsIdQueryKey(variables.id),
        });
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsByChallengeQueryKey({ challengeId }),
        });
      },
    },
  });

  const reopenMutation = usePostV1WorkSessionsIdReopen({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsIdQueryKey(variables.id),
        });
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsByChallengeQueryKey({ challengeId }),
        });
      },
    },
  });

  const resetMutation = useDeleteV1WorkSessionsIdReset({
    mutation: {
      onSuccess: (_, variables) => {
        setCreatedSessionId(null);
        queryClient.removeQueries({
          queryKey: getV1WorkSessionsIdQueryKey(variables.id),
        });
        queryClient.invalidateQueries({
          queryKey: getV1WorkSessionsByChallengeQueryKey({ challengeId }),
        });
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesIdSolutionQueryKey(challengeId),
        });
      },
    },
  });

  const rawChallenge = challengeQuery.data?.data ?? null;
  const challenge: Challenge | null = rawChallenge
    ? {
        ...rawChallenge,
        tags: rawChallenge.tags ?? [],
        supportMaterials: rawChallenge.supportMaterials ?? null,
      }
    : null;

  const rawSolution = solutionQuery.isError && is404(solutionQuery.error)
    ? null
    : (solutionQuery.data?.data ?? null);
  const solution: Solution | null = rawSolution
    ? {
        ...rawSolution,
        chatHistory: rawSolution.chatHistory ?? null,
      }
    : null;

  const rawWs = fullSessionQuery.data?.data;
  const workSession: WorkSession | null = rawWs
    ? mapWorkSession(rawWs)
    : null;

  const isSessionEnded = workSession?.endedAt != null;

  /** Não incluir fullSessionQuery: ao criar sessão no 1.º chat, GET /work-sessions/:id
   *  ficaria em loading e desmontava a UI inteira (abas voltavam para «Problema»). */
  const isLoading =
    challengeQuery.isLoading || byChallengeQuery.isLoading;

  const error =
    challengeQuery.error && !is404(challengeQuery.error)
      ? (challengeQuery.error instanceof Error
          ? challengeQuery.error.message
          : "Problema não encontrado")
      : null;

  const ensureWorkSession = useCallback(async (): Promise<WorkSession | null> => {
    logWs("ensureWorkSession:start", {
      challengeId,
      hasWorkSession: !!workSession,
      endedAt: workSession?.endedAt ?? null,
      sessionId: sessionId ?? null,
      createdSessionId: createdSessionId ?? null,
      byChallenge: {
        isLoading: byChallengeQuery.isLoading,
        isFetched: byChallengeQuery.isFetched,
        isError: byChallengeQuery.isError,
        dataId: byChallengeQuery.data?.data?.id ?? null,
      },
      challengeTaCount: challenge?.teachingAssistants?.length ?? 0,
    });

    if (workSession?.endedAt) {
      logWs("ensureWorkSession:exit sessão já terminada (endedAt)", {
        endedAt: workSession.endedAt,
      });
      return null;
    }
    if (workSession) {
      logWs("ensureWorkSession:reuse workSession em memória", {
        id: workSession.id,
      });
      return workSession;
    }

    // Já temos id (by-challenge) mas GET /:id ainda não hidratou o estado — ir buscar em vez de criar (evita 409).
    if (sessionId) {
      logWs("ensureWorkSession:fetch GET /work-sessions/:id", { sessionId });
      try {
        const fullSession = await queryClient.fetchQuery(
          getV1WorkSessionsIdQueryOptions(sessionId)
        );
        const mapped = mapWorkSession(fullSession.data);
        if (mapped.endedAt) {
          logWs("ensureWorkSession:exit sessão terminada após fetch", {
            id: mapped.id,
            endedAt: mapped.endedAt,
          });
          return null;
        }
        logWs("ensureWorkSession:ok após fetch por id", { id: mapped.id });
        return mapped;
      } catch (err) {
        logWsError("ensureWorkSession:erro em fetch GET /work-sessions/:id", err);
        return null;
      }
    }

    const defaultTa =
      challenge?.teachingAssistants?.find((t) => t.isDefault) ??
      challenge?.teachingAssistants?.[0];

    logWs("ensureWorkSession:POST criar sessão", {
      challengeId,
      teachingAssistantId: defaultTa?.id ?? "(omitido — servidor escolhe)",
    });
    try {
      const response = await createSessionMutation.mutateAsync({
        data: defaultTa
          ? { challengeId, teachingAssistantId: defaultTa.id }
          : { challengeId },
      });
      const newSessionId = response.data.id;
      setCreatedSessionId(newSessionId);
      const fullSession = await queryClient.fetchQuery(
        getV1WorkSessionsIdQueryOptions(newSessionId)
      );
      logWs("ensureWorkSession:ok após criar", { id: newSessionId });
      return mapWorkSession(fullSession.data);
    } catch (err) {
      const status =
        err instanceof ApiError
          ? err.status
          : err instanceof Error && "status" in err
            ? (err as { status: number }).status
            : undefined;
      logWsError("ensureWorkSession:erro ao criar sessão", err);
      logWs("ensureWorkSession:status do erro", { status: status ?? "unknown" });

      // 409 → sessão já existe (race condition); ir buscá-la em vez de criar.
      if (status === 409) {
        logWs("ensureWorkSession:409 → recuperar via by-challenge", {});
        try {
          const byChallenge = await queryClient.fetchQuery(
            getV1WorkSessionsByChallengeQueryOptions({ challengeId })
          );
          const existingId = byChallenge.data?.id;
          logWs("ensureWorkSession:409 recovery by-challenge", {
            existingId: existingId ?? null,
          });
          if (!existingId) return null;
          setCreatedSessionId(existingId);
          const fullSession = await queryClient.fetchQuery(
            getV1WorkSessionsIdQueryOptions(existingId)
          );
          const mapped = mapWorkSession(fullSession.data);
          if (mapped.endedAt) {
            logWs("ensureWorkSession:exit 409 recovery sessão terminada", {
              endedAt: mapped.endedAt,
            });
            return null;
          }
          logWs("ensureWorkSession:ok após 409 recovery", { id: mapped.id });
          return mapped;
        } catch (recoveryErr) {
          logWsError("ensureWorkSession:erro no recovery 409", recoveryErr);
          return null;
        }
      }
      return null;
    }
  }, [
    challenge,
    workSession,
    sessionId,
    challengeId,
    createdSessionId,
    createSessionMutation,
    queryClient,
    byChallengeQuery.isLoading,
    byChallengeQuery.isFetched,
    byChallengeQuery.isError,
    byChallengeQuery.data,
  ]);

  const refetch = useCallback(async () => {
    await Promise.all([
      challengeQuery.refetch(),
      solutionQuery.refetch(),
      byChallengeQuery.refetch(),
      ...(sessionId ? [fullSessionQuery.refetch()] : []),
    ]);
  }, [
    challengeQuery,
    solutionQuery,
    byChallengeQuery,
    fullSessionQuery,
    sessionId,
  ]);

  const saveSolution = useCallback(
    async (data: { code?: string; stdin?: string; stdout?: string }) => {
      if (!challengeId) return;
      try {
        await putSolutionMutation.mutateAsync({ id: challengeId, data });
      } catch (err) {
        console.error("Erro ao salvar solução:", err);
      }
    },
    [challengeId, putSolutionMutation]
  );

  const addInteraction = useCallback(
    async (data: {
      interactionType: "chat" | "code_run";
      userPrompt?: string;
      modelResponse?: string;
      code?: string;
      stdin?: string;
      stdout?: string;
    }) => {
      const session = await ensureWorkSession();
      if (!session) return;
      try {
        await addInteractionMutation.mutateAsync({
          id: session.id,
          data: {
            interactionType: data.interactionType,
            userPrompt: data.userPrompt ?? "",
            modelResponse: data.modelResponse ?? "",
            code: data.code,
            stdin: data.stdin,
            stdout: data.stdout,
          },
        });
      } catch (err) {
        console.error("Erro ao salvar interação:", err);
      }
    },
    [ensureWorkSession, addInteractionMutation]
  );

  const sendChatMessage = useCallback(
    async (params: {
      message: string;
      code?: string;
      stdin?: string;
      stdout?: string;
    }) => {
      logWs("sendChatMessage:before ensureWorkSession", {
        challengeId,
        messageLen: params.message?.length ?? 0,
      });
      const session = await ensureWorkSession();
      if (!session) {
        logWs("sendChatMessage:FALHA — ensureWorkSession devolveu null", {
          challengeId,
          hint: "Ver logs acima de ensureWorkSession:* para o motivo",
        });
        throw new Error("Sessão de trabalho não disponível");
      }
      logWs("sendChatMessage:POST chat", { sessionId: session.id });
      const result = await chatMutation.mutateAsync({
        id: session.id,
        data: {
          message: params.message,
          code: params.code,
          stdin: params.stdin,
          stdout: params.stdout,
        },
      });
      return { modelResponse: result.data.modelResponse };
    },
    [ensureWorkSession, chatMutation]
  );

  const submitWorkSession = useCallback(async () => {
    if (!workSession?.id || workSession.endedAt) return;
    await submitMutation.mutateAsync({ id: workSession.id });
  }, [workSession, submitMutation]);

  const reopenWorkSession = useCallback(async () => {
    if (!workSession?.id || !workSession.endedAt) return;
    await reopenMutation.mutateAsync({ id: workSession.id });
  }, [workSession, reopenMutation]);

  const resetWorkSession = useCallback(async () => {
    if (!workSession?.id) return;
    await resetMutation.mutateAsync({ id: workSession.id });
    useCodeEditorStore.getState().clearProblemSessionStorage();
  }, [workSession, resetMutation]);

  const value: ProblemContextValue = {
    challengeId,
    challenge,
    workSession,
    solution,
    isSessionEnded,
    isLoading,
    error,
    refetch,
    saveSolution,
    addInteraction,
    sendChatMessage,
    submitWorkSession,
    reopenWorkSession,
    resetWorkSession,
  };

  return (
    <ProblemContext.Provider value={value}>{children}</ProblemContext.Provider>
  );
}

export function useProblem() {
  const ctx = useContext(ProblemContext);
  if (!ctx) throw new Error("useProblem must be used within ProblemProvider");
  return ctx;
}
