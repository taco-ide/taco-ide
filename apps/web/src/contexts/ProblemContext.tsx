"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

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

export function ProblemProvider({
  challengeId,
  children,
}: {
  challengeId: string;
  children: ReactNode;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [workSession, setWorkSession] = useState<WorkSession | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithCreds = useCallback(
    async (url: string, options?: RequestInit) => {
      const res = await fetch(`${API_URL}${url}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erro na requisição");
      return json;
    },
    []
  );

  const loadData = useCallback(async () => {
    if (!challengeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [chRes, sessionRes, solutionRes] = await Promise.allSettled([
        fetchWithCreds(`/v1/challenges/${challengeId}`),
        fetchWithCreds(`/v1/work-sessions/by-challenge?challengeId=${challengeId}`),
        fetchWithCreds(`/v1/challenges/${challengeId}/solution`),
      ]);

      if (chRes.status === "fulfilled") {
        setChallenge(chRes.value.data);
      } else {
        setError(chRes.reason?.message || "Problema não encontrado");
        return;
      }

      if (sessionRes.status === "fulfilled") {
        const session = sessionRes.value.data;
        const fullSession = await fetchWithCreds(`/v1/work-sessions/${session.id}`);
        setWorkSession(fullSession.data);
      } else {
        setWorkSession(null);
      }

      if (solutionRes.status === "fulfilled") {
        setSolution(solutionRes.value.data);
      } else {
        setSolution(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, fetchWithCreds]);

  const ensureWorkSession = useCallback(async () => {
    if (workSession) return workSession;
    if (!challenge?.teachingAssistants?.length) return null;
    const defaultTa =
      challenge.teachingAssistants.find((t) => t.isDefault) ??
      challenge.teachingAssistants[0];
    const res = await fetchWithCreds("/v1/work-sessions", {
      method: "POST",
      body: JSON.stringify({
        challengeId,
        teachingAssistantId: defaultTa.id,
      }),
    });
    const fullSession = await fetchWithCreds(`/v1/work-sessions/${res.data.id}`);
    setWorkSession(fullSession.data);
    return fullSession.data;
  }, [challenge, workSession, challengeId, fetchWithCreds]);

  const saveSolution = useCallback(
    async (data: { code?: string; stdin?: string; stdout?: string }) => {
      if (!challengeId) return;
      try {
        const res = await fetchWithCreds(`/v1/challenges/${challengeId}/solution`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        setSolution(res.data);
      } catch (err) {
        console.error("Erro ao salvar solução:", err);
      }
    },
    [challengeId, fetchWithCreds]
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
        const res = await fetchWithCreds(`/v1/work-sessions/${session.id}/interactions`, {
          method: "POST",
          body: JSON.stringify({
            interactionType: data.interactionType,
            userPrompt: data.userPrompt ?? "",
            modelResponse: data.modelResponse ?? "",
            code: data.code,
            stdin: data.stdin,
            stdout: data.stdout,
          }),
        });
        setWorkSession((prev) =>
          prev
            ? {
                ...prev,
                interactions: [...prev.interactions, res.data],
              }
            : null
        );
      } catch (err) {
        console.error("Erro ao salvar interação:", err);
      }
    },
    [ensureWorkSession, fetchWithCreds]
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
      const res = await fetchWithCreds(`/v1/work-sessions/${session.id}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: params.message,
          code: params.code,
          stdin: params.stdin,
          stdout: params.stdout,
        }),
      });
      setWorkSession((prev) =>
        prev
          ? {
              ...prev,
              interactions: [
                ...prev.interactions,
                {
                  id: res.data.interactionId,
                  interactionType: "chat",
                  userPrompt: params.message,
                  modelResponse: res.data.modelResponse,
                  code: null,
                  stdin: null,
                  stdout: null,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : null
      );
      return { modelResponse: res.data.modelResponse };
    },
    [ensureWorkSession, fetchWithCreds]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const value: ProblemContextValue = {
    challengeId,
    challenge,
    workSession,
    solution,
    isLoading,
    error,
    refetch: loadData,
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
