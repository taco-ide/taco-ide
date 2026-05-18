"use client";

import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

/**
 * Rendered inside the (inside) layout when the authenticated user has no
 * active organization to operate on. This happens when:
 *  - The user's only org was deactivated by a platform admin (the deactivate
 *    route clears matching session.activeOrganizationId).
 *  - The user was removed from all their orgs.
 *  - The user is brand new and was never added to an org (edge case).
 *
 * Platform admins bypass this check because the layout/middleware grants them
 * global access regardless of membership. Regular users are shown this screen
 * instead of a half-broken /explore where every action 400s/403s.
 */
export function NoActiveOrganization() {
  const { user, logout } = useUser();

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-slate-500/15 blur-3xl"
      />
      <div className="relative max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 text-center backdrop-blur">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-white">
          Nenhuma organização ativa
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Você não está em nenhuma organização ativa no momento. Isso pode ter
          acontecido porque sua organização foi desativada ou porque você foi
          removido. Procure um administrador da plataforma para regularizar
          seu acesso.
        </p>
        {user?.email && (
          <div className="mt-5 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            Conectado como{" "}
            <span className="font-medium text-white">{user.email}</span>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button variant="outline-dark" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
