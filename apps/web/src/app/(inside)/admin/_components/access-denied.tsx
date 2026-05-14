"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

export function AccessDenied() {
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
        <h1 className="text-xl font-semibold text-white">Acesso restrito</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Você não tem permissão de{" "}
          <span className="font-semibold text-amber-400">Platform Admin</span>{" "}
          para acessar esta área. Se você acredita que isso é um engano,
          procure um administrador da plataforma.
        </p>
        {user?.email && (
          <div className="mt-5 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            Conectado como{" "}
            <span className="font-medium text-white">{user.email}</span>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline-dark">
            <Link href="/explore">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o app
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
