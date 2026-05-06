"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

const STORAGE_KEY = "taco_problem_workspace_onboarding_v1";

function shouldShowForRole(role: string | null): boolean {
  if (role === "teacher" || role === "coordinator" || role === "admin") {
    return false;
  }
  return true;
}

const checklistItems: string[] = [
  "Na aba Problema, leia o enunciado com calma antes de codar.",
  "No painel da direita, edite seu codigo no editor.",
  "Use Executar para rodar o programa e ver o resultado.",
  "Na aba Input / Output, ajuste a entrada de teste e confira a saida.",
  "Na aba Chat, peca ajuda ao assistente quando travar (ele usa seu codigo e o enunciado).",
];

export function ProblemWorkspaceOnboarding() {
  const { user, isLoading: userLoading } = useUser();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  if (!mounted || userLoading || hidden) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (!shouldShowForRole(user.role)) {
    return null;
  }

  return (
    <div className="shrink-0 px-3 pt-2">
      <div className="rounded-lg border border-amber-500/35 bg-amber-500/[0.08] text-amber-50/95 shadow-sm">
        <div className="flex items-start gap-3 p-3 pr-2">
          <div className="mt-0.5 rounded-md bg-amber-500/15 p-1.5 text-amber-400">
            <Lightbulb className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-amber-100 leading-tight">
                Primeiros passos nesta tela
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-amber-200/80 hover:bg-amber-500/15 hover:text-amber-100"
                onClick={handleDismiss}
                aria-label="Ocultar dicas"
              >
                <X className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-100/75 leading-relaxed">
              Checklist rapido — voce pode ocultar isso quando quiser; nao aparece de novo neste navegador.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2 text-xs text-zinc-200/95">
              {checklistItems.map((line) => (
                <li key={line} className="flex gap-2 items-start">
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-amber-400/90" />
                  <span className="leading-snug">{line}</span>
                </li>
              ))}
            </ul>
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-amber-500/90 text-zinc-950 hover:bg-amber-400 text-xs font-medium"
                onClick={handleDismiss}
              >
                Entendi, ocultar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
