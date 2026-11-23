"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useHasMinimumRole } from "@/hooks/usePermission";
import { TaRatingsPanel } from "./_components/TaRatingsPanel";

export default function TaRatingsPage() {
  const t = useTranslations("taRatings");
  const { user, isLoading } = useUser();
  const isStaff = useHasMinimumRole("teacher");

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      </div>
    );
  }

  const allowed = isStaff || user.isPlatformAdmin;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("back")}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Star className="h-6 w-6 text-amber-400" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      {!allowed ? (
        <p className="text-sm text-slate-400">{t("accessDenied")}</p>
      ) : !user.activeOrganizationId ? (
        <p className="text-sm text-slate-400">{t("noOrganization")}</p>
      ) : (
        <TaRatingsPanel organizationId={user.activeOrganizationId} />
      )}
    </div>
  );
}
