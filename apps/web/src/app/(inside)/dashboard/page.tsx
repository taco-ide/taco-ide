"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Compass,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import {
  useGetV1Classrooms,
  useGetV1Challenges,
  useGetV1OrganizationsIdMembers,
} from "@/kubb/hooks";
import { useTutorial } from "@/hooks/useTutorial";

type RoleKey = "student" | "teacher" | "coordinator" | "admin";

function resolveRole(
  role: string | null | undefined,
  isPlatformAdmin: boolean
): RoleKey {
  if (isPlatformAdmin) return "admin";
  if (role === "coordinator") return "coordinator";
  if (role === "teacher") return "teacher";
  return "student";
}

function WelcomeBanner({
  firstName,
  roleKey,
  orgName,
}: {
  firstName: string;
  roleKey: RoleKey;
  orgName: string | null;
}) {
  const t = useTranslations("dashboard");
  return (
    <section className="rounded-xl border border-slate-700/60 bg-gradient-to-br from-slate-800/70 to-slate-900/70 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-amber-400/80 mb-1">
            {t(`role.${roleKey}`)}
            {orgName ? ` · ${orgName}` : ""}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {t("welcome", { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t(`subtitle.${roleKey}`)}
          </p>
        </div>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  accent: "amber" | "emerald" | "sky" | "violet";
}) {
  const accentRing: Record<typeof accent, string> = {
    amber: "border-amber-500/30 hover:border-amber-400/60",
    emerald: "border-emerald-500/30 hover:border-emerald-400/60",
    sky: "border-sky-500/30 hover:border-sky-400/60",
    violet: "border-violet-500/30 hover:border-violet-400/60",
  };
  const accentIcon: Record<typeof accent, string> = {
    amber: "bg-amber-500/15 text-amber-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    sky: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
  };
  return (
    <Link
      href={href}
      className={`group block rounded-xl border bg-slate-800/40 px-5 py-4 transition-colors ${accentRing[accent]}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentIcon[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ClassroomGrid({ scope }: { scope: "mine" | "org" }) {
  const t = useTranslations("dashboard");
  const { data, isLoading } = useGetV1Classrooms({ scope });
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
        {t("classrooms.empty")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.slice(0, 6).map((c) => (
        <Link
          key={c.id}
          href={`/classrooms/${c.id}`}
          className="group rounded-lg border border-slate-700/70 bg-slate-800/40 px-4 py-3 transition-colors hover:border-amber-400/50"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {c.title}
            </h3>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </div>
          {c.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              {c.description}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function OrgStatTile({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  loading: boolean;
  accent: "amber" | "emerald" | "sky" | "violet";
}) {
  const accentBg: Record<typeof accent, string> = {
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${accentBg[accent]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500 mt-1" />
        ) : (
          <p className="text-xl font-semibold text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

function OrgOverview({ organizationId }: { organizationId: string }) {
  const t = useTranslations("dashboard");
  const { data: classroomsData, isLoading: loadingClassrooms } =
    useGetV1Classrooms({ scope: "org" });
  const { data: teachersData, isLoading: loadingTeachers } =
    useGetV1OrganizationsIdMembers(organizationId, { role: "teacher" });
  const { data: studentsData, isLoading: loadingStudents } =
    useGetV1OrganizationsIdMembers(organizationId, { role: "student" });

  const classroomCount = classroomsData?.data?.length ?? 0;
  const teacherCount = teachersData?.data?.length ?? 0;
  const studentCount = studentsData?.data?.length ?? 0;

  return (
    <section data-tour="org-overview">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <ShieldCheck className="mr-1.5 inline h-4 w-4 align-text-bottom" />
        {t("orgOverview.title")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OrgStatTile
          icon={BookOpen}
          label={t("orgOverview.classrooms")}
          value={classroomCount}
          loading={loadingClassrooms}
          accent="amber"
        />
        <OrgStatTile
          icon={Users}
          label={t("orgOverview.teachers")}
          value={teacherCount}
          loading={loadingTeachers}
          accent="emerald"
        />
        <OrgStatTile
          icon={Users}
          label={t("orgOverview.students")}
          value={studentCount}
          loading={loadingStudents}
          accent="sky"
        />
      </div>
    </section>
  );
}

function TeacherChallenges() {
  const t = useTranslations("dashboard");
  const { data, isLoading } = useGetV1Challenges({ scope: "mine" });
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
        {t("teacherChallenges.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.slice(0, 5).map((ch) => (
        <Link
          key={ch.id}
          href={`/create/${ch.id}/submissions`}
          className="group flex items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-800/40 px-4 py-2.5 transition-colors hover:border-amber-400/50"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-white">
            {ch.title}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {t("teacherChallenges.viewSubmissions")}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
        </Link>
      ))}
    </div>
  );
}

function DashboardContent() {
  const t = useTranslations("dashboard");
  const tour = useTranslations("dashboard.tour");
  const { user, isLoading, getFirstName } = useUser();

  const roleKey = user
    ? resolveRole(user.role, user.isPlatformAdmin)
    : "student";

  useTutorial(
    "coordinator-onboarding",
    [
      {
        element: '[data-tour="welcome-banner"]',
        popover: {
          title: tour("coordinator.welcome.title"),
          description: tour("coordinator.welcome.description"),
        },
      },
      {
        element: '[data-tour="quick-actions"]',
        popover: {
          title: tour("coordinator.quickActions.title"),
          description: tour("coordinator.quickActions.description"),
        },
      },
      {
        element: '[data-tour="org-overview"]',
        popover: {
          title: tour("coordinator.orgOverview.title"),
          description: tour("coordinator.orgOverview.description"),
        },
      },
      {
        element: '[data-tour="classroom-grid"]',
        popover: {
          title: tour("coordinator.classrooms.title"),
          description: tour("coordinator.classrooms.description"),
        },
      },
    ],
    {
      autoStart: roleKey === "coordinator" && !isLoading,
      nextBtnText: tour("buttons.next"),
      prevBtnText: tour("buttons.back"),
      doneBtnText: tour("buttons.done"),
    }
  );

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div data-tour="welcome-banner">
        <WelcomeBanner
          firstName={getFirstName()}
          roleKey={roleKey}
          orgName={user.activeOrganizationName}
        />
      </div>

      <section data-tour="quick-actions">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {t("quickActions.title")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roleKey === "student" && (
            <>
              <QuickAction
                href="/explore"
                icon={Compass}
                title={t("quickActions.exploreProblems.title")}
                description={t("quickActions.exploreProblems.description")}
                accent="amber"
              />
              <QuickAction
                href="/classrooms"
                icon={BookOpen}
                title={t("quickActions.myClassrooms.title")}
                description={t("quickActions.myClassrooms.description")}
                accent="emerald"
              />
            </>
          )}
          {roleKey === "teacher" && (
            <>
              <QuickAction
                href="/create"
                icon={Plus}
                title={t("quickActions.newChallenge.title")}
                description={t("quickActions.newChallenge.description")}
                accent="amber"
              />
              <QuickAction
                href="/classrooms"
                icon={BookOpen}
                title={t("quickActions.myClassrooms.title")}
                description={t("quickActions.myClassrooms.description")}
                accent="emerald"
              />
              <QuickAction
                href="/explore"
                icon={Compass}
                title={t("quickActions.exploreProblems.title")}
                description={t("quickActions.exploreProblems.description")}
                accent="sky"
              />
            </>
          )}
          {roleKey === "coordinator" && (
            <>
              <QuickAction
                href="/classrooms"
                icon={BookOpen}
                title={t("quickActions.myClassrooms.title")}
                description={t("quickActions.myClassrooms.description")}
                accent="emerald"
              />
              <QuickAction
                href="/create"
                icon={Plus}
                title={t("quickActions.newChallenge.title")}
                description={t("quickActions.newChallenge.description")}
                accent="amber"
              />
              <QuickAction
                href="/explore"
                icon={Compass}
                title={t("quickActions.exploreProblems.title")}
                description={t("quickActions.exploreProblems.description")}
                accent="sky"
              />
            </>
          )}
          {roleKey === "admin" && (
            <>
              <QuickAction
                href="/admin"
                icon={ShieldCheck}
                title={t("quickActions.adminConsole.title")}
                description={t("quickActions.adminConsole.description")}
                accent="violet"
              />
              <QuickAction
                href="/explore"
                icon={Compass}
                title={t("quickActions.exploreProblems.title")}
                description={t("quickActions.exploreProblems.description")}
                accent="sky"
              />
            </>
          )}
        </div>
      </section>

      {(roleKey === "teacher" || roleKey === "coordinator") && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              <ClipboardCheck className="mr-1.5 inline h-4 w-4 align-text-bottom" />
              {t("teacherChallenges.title")}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 bg-slate-800/80 text-slate-200"
              asChild
            >
              <Link href="/create">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("teacherChallenges.create")}
              </Link>
            </Button>
          </div>
          <TeacherChallenges />
        </section>
      )}

      {roleKey === "coordinator" && user.activeOrganizationId && (
        <OrgOverview organizationId={user.activeOrganizationId} />
      )}

      <section data-tour="classroom-grid">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Users className="mr-1.5 inline h-4 w-4 align-text-bottom" />
            {roleKey === "coordinator"
              ? t("classrooms.titleOrg")
              : t("classrooms.title")}
          </h2>
          <Link
            href="/classrooms"
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
          >
            {t("classrooms.viewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ClassroomGrid scope={roleKey === "coordinator" ? "org" : "mine"} />
      </section>

      {roleKey === "student" && (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">
                {t("studentTip.title")}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t("studentTip.description")}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
