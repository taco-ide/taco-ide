"use client";

import { Bell, CircleHelp, Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BreadcrumbItem } from "./admin-breadcrumbs";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";

interface AdminTopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Called when the user opens the mobile sidebar via the hamburger button. */
  onOpenMobileSidebar?: () => void;
}

export function AdminTopbar({
  breadcrumbs,
  onOpenMobileSidebar,
}: AdminTopbarProps) {
  const t = useTranslations("admin");
  const c = useTranslations("common");
  return (
    <div className="flex h-14 items-center gap-3 border-b border-slate-800/80 bg-slate-950/40 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800/60 hover:text-white lg:hidden"
        title={t("topbar.openMenu")}
        aria-label={t("topbar.openMenu")}
      >
        <Menu className="h-4 w-4" />
      </button>
      <AdminBreadcrumbs items={breadcrumbs} />
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title={c("search")}
          aria-label={c("search")}
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title={t("topbar.notifications")}
          aria-label={t("topbar.notifications")}
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-white"
          title={t("topbar.help")}
          aria-label={t("topbar.help")}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
