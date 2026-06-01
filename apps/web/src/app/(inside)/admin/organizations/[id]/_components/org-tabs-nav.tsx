"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Mail, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgTabsNavProps {
  orgId: string;
}

const tabs = [
  { key: "members", labelKey: "tabs.members", icon: Users },
  { key: "invitations", labelKey: "tabs.invitations", icon: Mail },
  { key: "domains", labelKey: "tabs.domains", icon: Globe },
  { key: "settings", labelKey: "tabs.settings", icon: Settings },
] as const;

export function OrgTabsNav({ orgId }: OrgTabsNavProps) {
  const t = useTranslations("adminOrgs");
  const pathname = usePathname() ?? "";

  return (
    <div className="flex items-center gap-1 border-b border-slate-700/60">
      {tabs.map((tab) => {
        const href = `/admin/organizations/${orgId}/${tab.key}`;
        const active = pathname.startsWith(href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-amber-400 text-white"
                : "border-transparent text-slate-400 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
