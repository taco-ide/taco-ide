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
  getV1WorkSessionsByChallengeQueryKey,
  getV1WorkSessionsIdQueryKey,
  getV1WorkSessionsIdQueryOptions,
  getV1ChallengesIdSolutionQueryKey,
} from "@/kubb/hooks";
import { ApiError } from "@/lib/apiClient";

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
};

const ProblemContext = createContext<ProblemContextValue | null>(null);

function is404(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
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
        retry: (_, error) => !is404(error),
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

  const workSession = fullSessionQuery.data?.data ?? null;

  const isLoading =
    challengeQuery.isLoading ||
    (!!sessionId && fullSessionQuery.isLoading);

  const error =
    challengeQuery.error && !is404(challengeQuery.error)
      ? (challengeQuery.error instanceof Error
          ? challengeQuery.error.message
          : "Problema não encontrado")
      : null;

  const ensureWorkSession = useCallback(async (): Promise<WorkSession | null> => {
    if (workSession) return workSession;
    if (!challenge?.teachingAssistants?.length) return null;
    const defaultTa =
      challenge.teachingAssistants.find((t) => t.isDefault) ??
      challenge.teachingAssistants[0];
    try {
      const response = await createSessionMutation.mutateAsync({
        data: {
          challengeId,
          teachingAssistantId: defaultTa.id,
        },
      });
      const newSessionId = response.data.id;
      setCreatedSessionId(newSessionId);
      const fullSession = await queryClient.fetchQuery(
        getV1WorkSessionsIdQueryOptions(newSessionId)
      );
      return fullSession.data;
    } catch {
      return null;
    }
  }, [challenge, workSession, challengeId, createSessionMutation, queryClient]);

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
      const session = await ensureWorkSession();
      if (!session) throw new Error("Sessão de trabalho não disponível");
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

  const value: ProblemContextValue = {
    challengeId,
    challenge,
    workSession,
    solution,
    isLoading,
    error,
    refetch,
    saveSolution,
    addInteraction,
    sendChatMessage,
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
