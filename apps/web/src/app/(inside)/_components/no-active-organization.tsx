"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Inbox,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  AtSign,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { useGetV1UsersMeAccessStatus } from "@/kubb/hooks";

const KNOWN_ROLES = ["admin", "coordinator", "teacher", "student"] as const;
type KnownRole = (typeof KNOWN_ROLES)[number];

function isKnownRole(role: string): role is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(role);
}

/**
 * First-access screen, rendered inside the (inside) layout when the
 * authenticated user has no active organization to operate on:
 *  - brand-new accounts that signed up without an invitation or a mapped
 *    email domain (the common case);
 *  - users whose organization was deactivated by a platform admin;
 *  - users removed from every organization (indistinguishable from a new
 *    account, since the membership row is deleted).
 *
 * It explains how access is granted, lists pending invitations addressed to
 * the user's verified email (linking to /auth/accept-invitation), and offers
 * a "check again" action. Self-service organization creation is deliberately
 * absent: only platform admins create organizations.
 *
 * Platform admins bypass this screen because their tooling is global.
 */
export function NoActiveOrganization() {
  const t = useTranslations("firstAccess");
  const c = useTranslations("common");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { user, logout, fetchUser } = useUser();
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  const { data, refetch } = useGetV1UsersMeAccessStatus();
  const status = data?.data;
  const invitations = status?.pendingInvitations ?? [];
  const orgInactive = status?.hasInactiveOrganizationMembership ?? false;

  const checkAgain = async () => {
    setChecking(true);
    setStillPending(false);
    try {
      const [, statusResult] = await Promise.all([fetchUser(), refetch()]);
      // When the user now has an active membership, the refreshed /me
      // resolves it as the active organization and the layout swaps this
      // screen for the app. Drop anything cached while access was missing.
      if (statusResult.data?.data.hasActiveMembership) {
        await queryClient.invalidateQueries();
      } else {
        setStillPending(true);
      }
    } finally {
      setChecking(false);
    }
  };

  const roleLabel = (role: string) =>
    isKnownRole(role) ? t(`roles.${role}`) : role;

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center overflow-hidden px-4 py-10 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-slate-500/15 blur-3xl"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 backdrop-blur sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            {orgInactive ? (
              <ShieldAlert className="h-6 w-6" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-white">
            {orgInactive ? t("inactive.title") : t("newUser.title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {orgInactive
              ? t("inactive.description")
              : t("newUser.description")}
          </p>
          {user?.email && (
            <div className="mt-5 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
              {t.rich("loggedInAs", {
                email: user.email,
                strong: (chunks) => (
                  <span className="break-all font-medium text-white">
                    {chunks}
                  </span>
                ),
              })}
            </div>
          )}
        </div>

        {invitations.length > 0 && (
          <section className="mt-6" aria-labelledby="first-access-invitations">
            <h2
              id="first-access-invitations"
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"
            >
              <Inbox className="h-4 w-4 text-amber-400" />
              {t("invitations.title", { count: invitations.length })}
            </h2>
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-white">
                      {inv.organizationName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t("invitations.role", { role: roleLabel(inv.role) })}
                      {inv.inviterName &&
                        ` · ${t("invitations.invitedBy", { name: inv.inviterName })}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("invitations.expires", {
                        date: format.dateTime(new Date(inv.expiresAt), {
                          dateStyle: "medium",
                        }),
                      })}
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link
                      href={`/auth/accept-invitation?id=${encodeURIComponent(inv.id)}`}
                    >
                      {t("invitations.review")}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6" aria-labelledby="first-access-next-steps">
          <h2
            id="first-access-next-steps"
            className="mb-3 text-sm font-semibold text-white"
          >
            {t("nextSteps.title")}
          </h2>
          <ul className="space-y-3 text-sm text-slate-400">
            {orgInactive ? (
              <li className="flex gap-3">
                <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>{t("nextSteps.contactCoordinatorInactive")}</span>
              </li>
            ) : (
              <>
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{t("nextSteps.checkEmail")}</span>
                </li>
                <li className="flex gap-3">
                  <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{t("nextSteps.askForInvite")}</span>
                </li>
                <li className="flex gap-3">
                  <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{t("nextSteps.institutionalEmail")}</span>
                </li>
              </>
            )}
          </ul>
          {user && !user.emailVerified && (
            <p className="mt-4 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
              {t("verifyEmailHint")}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">
            {orgInactive ? t("removedHint") : t("noSelfServiceHint")}
          </p>
        </section>

        {stillPending && (
          <p
            role="status"
            className="mt-6 rounded-md border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-center text-xs text-slate-300"
          >
            {t("stillPending")}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button variant="outline-dark" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            {c("signOut")}
          </Button>
          <Button onClick={() => void checkAgain()} disabled={checking}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`}
            />
            {checking ? t("checking") : t("checkAgain")}
          </Button>
        </div>
      </div>
    </div>
  );
}
