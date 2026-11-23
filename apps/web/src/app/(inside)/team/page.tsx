"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DriveStep } from "driver.js";
import {
  AlertTriangle,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  Loader2,
  Mail,
  Plus,
  RotateCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pager } from "@/components/admin/pager";
import { EmptyState } from "@/components/admin/empty-state";
import { RoleBadge, type AdminRole } from "@/components/admin/role-badge";
import { CreateInvitationDialog } from "@/components/admin/create-invitation-dialog";
import {
  InvitationsTable,
  type InvitationRow,
} from "@/components/admin/invitations-table";
import { useUser } from "@/contexts/UserContext";
import { useHasMinimumRole, useRole } from "@/hooks/usePermission";
import { useTutorial } from "@/hooks/useTutorial";
import { useGetV1OrganizationsIdInvitations } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdInvitations";
import { hasMinimumRole } from "@repo/infra/auth/client";

const PER_PAGE = 20;
const ALL_ROLES: AdminRole[] = ["student", "teacher", "coordinator", "admin"];

function JoinMethodCard({
  icon: Icon,
  title,
  body,
  badge,
  tone,
  tourId,
}: {
  icon: typeof Mail;
  title: string;
  body: string;
  badge: string;
  tone: "available" | "adminOnly";
  tourId: string;
}) {
  const badgeClass =
    tone === "available"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-slate-600 bg-slate-800 text-slate-300";
  return (
    <div
      data-tour={tourId}
      className="flex flex-col gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
        >
          {badge}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function NotAllowed() {
  const t = useTranslations("teamInvitations");
  const { user } = useUser();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md space-y-3 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-400" />
        <h1 className="text-xl font-semibold text-white">
          {t("notAllowed.title")}
        </h1>
        <p className="text-sm text-slate-400">{t("notAllowed.description")}</p>
        {user?.isPlatformAdmin ? (
          <Button asChild variant="outline-dark">
            <Link href="/admin/organizations">
              {t("notAllowed.adminConsole")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TeamInvitations({ organizationId }: { organizationId: string }) {
  const t = useTranslations("teamInvitations");
  const tRole = useTranslations("adminShared.role");
  const c = useTranslations("common");
  const tour = useTranslations("teamInvitations.tour");
  const { user } = useUser();
  const role = useRole();

  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);

  // A coordinator is only offered roles up to their own; inviting someone
  // with more privileges than the inviter is left to admins.
  const roleOptions = useMemo(
    () => ALL_ROLES.filter((r) => role !== null && hasMinimumRole(role, r)),
    [role]
  );

  // The Kubb-generated params type only exposes `status`; the endpoint also
  // accepts `page`/`perPage` (see the admin invitations page).
  const queryParams = useMemo(
    () =>
      ({ status: "pending", page, perPage: PER_PAGE }) as unknown as Parameters<
        typeof useGetV1OrganizationsIdInvitations
      >[1],
    [page]
  );
  const { data, isLoading, isFetching, error, refetch } =
    useGetV1OrganizationsIdInvitations(organizationId, queryParams);

  const rows = useMemo<InvitationRow[]>(
    () =>
      (data?.data ?? []).map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        inviterName: inv.inviterName,
        inviterEmail: inv.inviterEmail,
      })),
    [data]
  );
  const pagination = data?.pagination ?? {
    total: rows.length,
    page: 1,
    perPage: PER_PAGE,
    totalPages: 1,
  };
  const showEmpty = !isLoading && !error && rows.length === 0 && page === 1;

  const steps = useMemo<DriveStep[]>(
    () => [
      {
        popover: {
          title: tour("welcome.title"),
          description: tour("welcome.description"),
        },
      },
      {
        element: '[data-tour="join-invite"]',
        popover: {
          title: tour("invite.title"),
          description: tour("invite.description"),
        },
      },
      {
        element: '[data-tour="join-domain"]',
        popover: {
          title: tour("domain.title"),
          description: tour("domain.description"),
        },
      },
      {
        element: '[data-tour="join-csv"]',
        popover: {
          title: tour("csv.title"),
          description: tour("csv.description"),
        },
      },
      {
        element: '[data-tour="roles"]',
        popover: {
          title: tour("roles.title"),
          description: tour("roles.description"),
        },
      },
      {
        element: '[data-tour="new-invitation"]',
        popover: {
          title: tour("newInvitation.title"),
          description: tour("newInvitation.description"),
        },
      },
      {
        element: '[data-tour="pending-invitations"]',
        popover: {
          title: tour("pending.title"),
          description: tour("pending.description"),
        },
      },
    ],
    [tour]
  );

  const { startTour } = useTutorial("invite-flow", steps, {
    autoStart: true,
    nextBtnText: tour("buttons.next"),
    prevBtnText: tour("buttons.back"),
    doneBtnText: tour("buttons.done"),
  });

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs uppercase tracking-wider text-amber-400/80">
            {user?.activeOrganizationName ?? t("fallbackOrgName")}
          </p>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {t("subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline-dark"
          size="sm"
          onClick={startTour}
        >
          <HelpCircle className="mr-1.5 h-4 w-4" />
          {t("showTutorial")}
        </Button>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {t("methods.title")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <JoinMethodCard
            tourId="join-invite"
            icon={Mail}
            title={t("methods.invite.title")}
            body={t("methods.invite.body")}
            badge={t("methods.availableHere")}
            tone="available"
          />
          <JoinMethodCard
            tourId="join-domain"
            icon={Globe}
            title={t("methods.domain.title")}
            body={t("methods.domain.body")}
            badge={t("methods.adminOnly")}
            tone="adminOnly"
          />
          <JoinMethodCard
            tourId="join-csv"
            icon={FileSpreadsheet}
            title={t("methods.csv.title")}
            body={t("methods.csv.body")}
            badge={t("methods.adminOnly")}
            tone="adminOnly"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("methods.selfSignup")}</p>
      </section>

      <section data-tour="roles">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {t("roles.title")}
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <li
              key={r}
              className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-800/30 px-4 py-3"
            >
              <RoleBadge role={r} className="mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed text-slate-400">
                {t(`roles.${r}`)}
                {!roleOptions.includes(r) ? (
                  <span className="mt-1 block text-slate-500">
                    {t("roles.notOfferedToYou", { role: tRole(r) })}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-tour="pending-invitations" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              {t("pending.title")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("pending.description", { count: pagination.total })}
            </p>
          </div>
          <Button
            type="button"
            data-tour="new-invitation"
            onClick={() => setCreateOpen(true)}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("newInvitation")}
          </Button>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{t("loadError")}</span>
            </div>
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              onClick={() => void refetch()}
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              {c("retry")}
            </Button>
          </div>
        ) : showEmpty ? (
          <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
            <EmptyState
              icon={Mail}
              title={t("empty.title")}
              body={t("empty.body")}
              action={
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="bg-amber-500 text-slate-900 hover:bg-amber-400"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("empty.action")}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
            <InvitationsTable
              organizationId={organizationId}
              rows={rows}
              isLoading={isLoading || (isFetching && rows.length === 0)}
            />
            <Pager
              page={pagination.page}
              perPage={pagination.perPage}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>

      <CreateInvitationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId}
        roleOptions={roleOptions}
      />
    </div>
  );
}

export default function TeamPage() {
  const { user, isLoading } = useUser();
  const canInvite = useHasMinimumRole("coordinator");

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // The invitation endpoints require coordinator+ in the *active*
  // organization (platform admins use /admin instead).
  if (!canInvite || !user.activeOrganizationId) {
    return <NotAllowed />;
  }

  return <TeamInvitations organizationId={user.activeOrganizationId} />;
}
