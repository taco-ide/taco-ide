"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditorPanel from "./_components/EditorPanel";
import Header from "./_components/Header";
import IoPanel from "./_components/IoPanel";
import ProblemDescription from "./_components/ProblemDescription";
import ChatPanel from "./_components/ChatPanel";
import { ProblemWorkspaceOnboarding } from "./_components/ProblemWorkspaceOnboarding";
import { ProblemProvider, useProblem } from "@/contexts/ProblemContext";
import { Loader2, FileText, Terminal, MessageCircle } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useUser } from "@/contexts/UserContext";
import { useGetV1ChallengesId } from "@/kubb/hooks";
import { shouldOpenStaffWorkSessionsFirst } from "@/lib/staffProblemLanding";

function StaffWorkSessionsRedirect({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  useLayoutEffect(() => {
    router.replace(`/create/${challengeId}/work-sessions`);
  }, [challengeId, router]);
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0c0d10]">
      <Loader2 className="h-10 w-10 animate-spin text-amber-500/90" />
    </div>
  );
}

function ProblemPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const { user, isLoading: userLoading } = useUser();

  const challengeQuery = useGetV1ChallengesId(id ?? "", {
    query: { enabled: !!id },
  });

  useEffect(() => {
    if (!id) {
      router.replace("/explore");
    }
  }, [id, router]);

  if (!id) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0c0d10]">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500/90" />
      </div>
    );
  }

  const viewAsStudent = searchParams.get("view") === "student";

  if (userLoading || challengeQuery.isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0c0d10]">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500/90" />
      </div>
    );
  }

  if (challengeQuery.isError || !challengeQuery.data?.data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-[#0c0d10] text-zinc-400 p-4">
        <p className="text-rose-400/90">
          Não foi possível carregar o problema.
        </p>
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg text-sm transition-colors"
        >
          Voltar para Explorar
        </button>
      </div>
    );
  }

  const ch = challengeQuery.data.data;

  if (
    !viewAsStudent &&
    user &&
    shouldOpenStaffWorkSessionsFirst(user, ch)
  ) {
    return <StaffWorkSessionsRedirect challengeId={id} />;
  }

  return (
    <ProblemProvider challengeId={id}>
      <ProblemPageInner />
    </ProblemProvider>
  );
}

const PROBLEM_TAB_KEY = "problem-main-tab";
type ProblemMainTab = "problem" | "io" | "chat";

function ProblemPageInner() {
  const router = useRouter();
  const { challengeId, isLoading, error } = useProblem();
  const [mainTab, setMainTab] = useState<ProblemMainTab>(() => {
    if (typeof window === "undefined" || !challengeId) return "problem";
    try {
      const raw = sessionStorage.getItem(`${PROBLEM_TAB_KEY}:${challengeId}`);
      if (raw === "problem" || raw === "io" || raw === "chat") return raw;
    } catch {
      /* ignore */
    }
    return "problem";
  });

  useEffect(() => {
    if (!challengeId) return;
    try {
      const raw = sessionStorage.getItem(`${PROBLEM_TAB_KEY}:${challengeId}`);
      if (raw === "problem" || raw === "io" || raw === "chat") {
        setMainTab(raw);
      } else {
        setMainTab("problem");
      }
    } catch {
      setMainTab("problem");
    }
  }, [challengeId]);

  useEffect(() => {
    if (!challengeId) return;
    try {
      sessionStorage.setItem(`${PROBLEM_TAB_KEY}:${challengeId}`, mainTab);
    } catch {
      /* ignore */
    }
  }, [challengeId, mainTab]);

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-[#0c0d10] text-zinc-400 p-4">
        <p className="text-rose-400/90">{error}</p>
        <button
          onClick={() => router.push("/explore")}
          className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg text-sm transition-colors"
        >
          Voltar para Explorar
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0c0d10]">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500/90" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0d10] text-zinc-300 overflow-hidden">
      <Header />
      <ProblemWorkspaceOnboarding />

      <div className="flex-1 min-h-0 flex flex-col px-3 pb-3">
        <ResizablePanelGroup direction="horizontal" className="gap-1">
          {/* Painel esquerdo: descrição, output, input, chat */}
          <ResizablePanel defaultSize={45} minSize={30} className="min-w-0">
            <div className="h-full flex flex-col min-h-0 rounded-lg border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
              <Tabs
                value={mainTab}
                onValueChange={(v) =>
                  setMainTab(v as ProblemMainTab)
                }
                className="h-full flex flex-col min-h-0"
              >
                <TabsList className="shrink-0 h-11 px-1 gap-0.5 bg-transparent border-b border-zinc-800/60 rounded-none">
                  <TabsTrigger
                    value="problem"
                    className="data-[state=active]:bg-zinc-800/60 data-[state=active]:text-amber-400/90 rounded-md gap-1.5 px-3 text-xs"
                  >
                    <FileText className="size-3.5" />
                    Problema
                  </TabsTrigger>
                  <TabsTrigger
                    value="io"
                    className="data-[state=active]:bg-zinc-800/60 data-[state=active]:text-amber-400/90 rounded-md gap-1.5 px-3 text-xs"
                  >
                    <Terminal className="size-3.5" />
                    Input / Output
                  </TabsTrigger>
                  <TabsTrigger
                    value="chat"
                    className="data-[state=active]:bg-zinc-800/60 data-[state=active]:text-amber-400/90 rounded-md gap-1.5 px-3 text-xs"
                  >
                    <MessageCircle className="size-3.5" />
                    Chat
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TabsContent
                    value="problem"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ProblemDescription />
                  </TabsContent>
                  <TabsContent
                    value="io"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <IoPanel />
                  </TabsContent>
                  <TabsContent
                    value="chat"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ChatPanel />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-zinc-800/40 hover:bg-zinc-700/40 transition-colors" />

          {/* Painel direito: editor */}
          <ResizablePanel defaultSize={55} minSize={40} className="min-w-0">
            <div className="h-full min-h-0 pl-1">
              <EditorPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function ProblemPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#0c0d10]">
          <Loader2 className="h-10 w-10 animate-spin text-amber-500/90" />
        </div>
      }
    >
      <ProblemPageContent />
    </Suspense>
  );
}
