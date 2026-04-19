"use client";

import Link from "next/link";
import ThemeSelector from "./ThemeSelector";
import RunButton from "./RunButton";
import HeaderProfileBtn from "./HeaderProfileBtn";
import Image from "next/image";
import { useHasMinimumRole } from "@/hooks/usePermission";
import { useProblem } from "@/contexts/ProblemContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

function Header() {
  const isTeacherPlus = useHasMinimumRole("teacher");
  const {
    workSession,
    isSessionEnded,
    submitWorkSession,
    reopenWorkSession,
    resetWorkSession,
  } = useProblem();
  const [submitting, setSubmitting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const hasSession = !!workSession?.id;

  const handleSubmit = async () => {
    if (!hasSession || isSessionEnded) return;
    setSubmitting(true);
    try {
      await submitWorkSession();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!hasSession || !isSessionEnded) return;
    setReopening(true);
    try {
      await reopenWorkSession();
    } finally {
      setReopening(false);
    }
  };

  const handleReset = async () => {
    if (!hasSession) return;
    setResetting(true);
    try {
      await resetWorkSession();
      setResetDialogOpen(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="shrink-0">
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="hidden lg:flex items-center min-h-0">
          <Link
            href="/explore"
            className="flex items-center gap-2 group py-1"
            aria-label="Ir para Explorar"
          >
            <Image
              src="/header-logo.png"
              alt="TACO-IDE Logo"
              width={220}
              height={56}
              priority
              className="h-[52px] w-auto max-h-[calc(3.5rem-0.25rem)] object-contain object-left opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ThemeSelector />
          <RunButton />

          {/* Work session actions */}
          {hasSession && !isSessionEnded && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={handleSubmit}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              {submitting ? "A submeter…" : "Submeter"}
            </Button>
          )}

          {hasSession && isSessionEnded && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-rose-400/90 whitespace-nowrap">
                Já submetido
              </span>
              {isTeacherPlus && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={reopening}
                    onClick={handleReopen}
                    className="text-xs border-zinc-600 text-zinc-200"
                  >
                    {reopening ? "A reabrir…" : "Reabrir"}
                  </Button>
                  <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={resetting}
                        className="text-xs"
                      >
                        Reiniciar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                          Reiniciar problema?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Esta ação apaga a sessão de trabalho, o histórico de chat
                          e o código guardado para este desafio. Não pode ser
                          desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-200">
                          Cancelar
                        </AlertDialogCancel>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={resetting}
                          className="bg-rose-600 hover:bg-rose-500"
                          onClick={() => void handleReset()}
                        >
                          {resetting ? "A reiniciar…" : "Confirmar reinício"}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}

          <div className="pl-3 ml-1 border-l border-zinc-700/50">
            <HeaderProfileBtn />
          </div>
        </div>
      </div>
    </header>
  );
}
export default Header;
