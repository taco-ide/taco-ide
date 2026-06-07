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
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

function Header() {
  const t = useTranslations("problem");
  const c = useTranslations("common");
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
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [taGrade, setTaGrade] = useState<number>(0);
  const [taGradeHover, setTaGradeHover] = useState<number>(0);

  const hasSession = !!workSession?.id;

  const handleSubmit = async () => {
    if (!hasSession || isSessionEnded || taGrade < 1) return;
    setSubmitting(true);
    try {
      await submitWorkSession({ taGrade });
      setSubmitDialogOpen(false);
      setTaGrade(0);
      setTaGradeHover(0);
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
            aria-label={t("header.goToExplore")}
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
            <AlertDialog
              open={submitDialogOpen}
              onOpenChange={(open) => {
                setSubmitDialogOpen(open);
                if (!open) {
                  setTaGrade(0);
                  setTaGradeHover(0);
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  {submitting ? t("submit.submitting") : t("submit.action")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100">
                    {t("submit.dialogTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    {t.rich("submit.dialogDescription", {
                      strong: (chunks) => (
                        <strong className="text-zinc-200">{chunks}</strong>
                      ),
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-3">
                  <div
                    className="flex items-center gap-1"
                    role="radiogroup"
                    aria-label={t("submit.ratingLabel")}
                    onMouseLeave={() => setTaGradeHover(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (taGradeHover || taGrade) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={taGrade === n}
                          aria-label={t("submit.starLabel", { count: n })}
                          onClick={() => setTaGrade(n)}
                          onMouseEnter={() => setTaGradeHover(n)}
                          className="p-1 rounded hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <Star
                            className={
                              active
                                ? "h-7 w-7 text-amber-400 fill-amber-400"
                                : "h-7 w-7 text-zinc-600"
                            }
                          />
                        </button>
                      );
                    })}
                    <span className="ml-3 text-sm text-zinc-400 min-w-[3ch]">
                      {taGrade > 0 ? `${taGrade}/5` : "—"}
                    </span>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={submitting}
                    className="bg-zinc-800 border-zinc-700 text-zinc-200"
                  >
                    {c("cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={submitting || taGrade < 1}
                    onClick={(e) => {
                      e.preventDefault();
                      void handleSubmit();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {submitting
                      ? t("submit.submitting")
                      : t("submit.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {hasSession && isSessionEnded && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-rose-400/90 whitespace-nowrap">
                {t("session.alreadySubmitted")}
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
                    {reopening ? t("reopen.loading") : t("reopen.action")}
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
                        {t("reset.action")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                          {t("reset.dialogTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          {t("reset.dialogDescription")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-200">
                          {c("cancel")}
                        </AlertDialogCancel>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={resetting}
                          className="bg-rose-600 hover:bg-rose-500"
                          onClick={() => void handleReset()}
                        >
                          {resetting ? t("reset.loading") : t("reset.confirm")}
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
