"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

export function AccessDenied() {
  const t = useTranslations("admin");
  const { user } = useUser();

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-72 w-72 rounded-full bg-red-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl"
      />
      <div className="relative max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 text-center backdrop-blur">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-white">
          {t("accessDenied.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {t.rich("accessDenied.description", {
            role: (chunks) => (
              <span className="font-semibold text-amber-400">{chunks}</span>
            ),
          })}
        </p>
        {user?.email && (
          <div className="mt-5 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            {t.rich("accessDenied.loggedInAs", {
              email: user.email,
              strong: (chunks) => (
                <span className="font-medium text-white">{chunks}</span>
              ),
            })}
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline-dark">
            <Link href="/explore">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("accessDenied.backToApp")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
