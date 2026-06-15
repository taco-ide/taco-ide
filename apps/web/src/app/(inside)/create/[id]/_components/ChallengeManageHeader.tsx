"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClipboardCheck, Laptop, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGetV1ChallengesId } from "@/kubb/hooks";

type Tab = "submissions" | "work-sessions";

interface TabConfig {
  id: Tab;
  href: (challengeId: string) => string;
  labelKey: string;
  icon: typeof ClipboardCheck;
}

const TABS: TabConfig[] = [
  {
    id: "submissions",
    href: (id) => `/create/${id}/submissions`,
    labelKey: "tabs.submissions",
    icon: ClipboardCheck,
  },
  {
    id: "work-sessions",
    href: (id) => `/create/${id}/work-sessions`,
    labelKey: "tabs.workSessions",
    icon: Users,
  },
];

function getActiveTab(pathname: string | null): Tab | null {
  if (!pathname) return null;
  if (pathname.includes("/submissions")) return "submissions";
  if (pathname.includes("/work-sessions")) return "work-sessions";
  return null;
}

export function ChallengeManageHeader({
  challengeId,
}: {
  challengeId: string;
}) {
  const t = useTranslations("challengeManage");
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = getActiveTab(pathname);

  const { data: challengeData } = useGetV1ChallengesId(challengeId, {
    query: { enabled: !!challengeId },
  });
  const challenge = challengeData?.data;

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
      <div className="container mx-auto max-w-6xl px-4 pt-6 pb-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-amber-400/80 mb-1">
                {t("eyebrow")}
              </p>
              <h1 className="truncate text-2xl font-bold text-white">
                {challenge?.title ?? t("loading")}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 bg-slate-800/80 text-slate-200"
                onClick={() => router.push(`/create/${challengeId}`)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                {t("actions.edit")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-medium"
                onClick={() =>
                  router.push(`/problem/${challengeId}?view=student`)
                }
              >
                <Laptop className="w-3.5 h-3.5 mr-1.5" />
                {t("actions.studentView")}
              </Button>
            </div>
          </div>

          <nav
            aria-label={t("tabsLabel")}
            className="-mb-px flex items-center gap-1"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href(challengeId)}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-amber-400 text-amber-300"
                      : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {t(tab.labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
