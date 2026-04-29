"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgTabsNavProps {
  orgId: string;
}

const tabs = [
  { key: "members", label: "Membros", icon: Users },
  { key: "domains", label: "Domínios", icon: Globe },
  { key: "settings", label: "Configurações", icon: Settings },
] as const;

export function OrgTabsNav({ orgId }: OrgTabsNavProps) {
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
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
