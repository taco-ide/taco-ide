"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Calendar,
  CirclePause,
  CirclePlay,
  GraduationCap,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarSquare } from "@/components/admin/avatar-square";
import { StatusPill } from "@/components/admin/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePatchV1OrganizationsIdActive } from "@/kubb/hooks/organizationsHooks/usePatchV1OrganizationsIdActive";
import { getV1OrganizationsIdQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { EditOrganizationDialog } from "../../_components/edit-organization-dialog";

interface OrgHeaderProps {
  org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    isActive: boolean;
    createdAt: string;
    memberCount: number;
    classroomCount: number;
  };
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

export function OrgHeader({ org }: OrgHeaderProps) {
  const t = useTranslations("adminOrgs");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleActive = usePatchV1OrganizationsIdActive({
    mutation: {
      onSuccess: () => {
        toast.success(
          org.isActive ? t("toast.deactivated") : t("toast.reactivated"),
        );
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return (
              first?.url === "/v1/organizations/" ||
              first?.url === "/v1/organizations/:id"
            );
          },
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdQueryKey(org.id),
        });
        setConfirmOpen(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : t("toast.statusUpdateError"),
        );
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <AvatarSquare name={org.name} src={org.logo} size="lg" />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">{org.name}</h1>
              <StatusPill active={org.isActive} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <AtSign className="h-3 w-3" />
                {org.slug}
              </span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {t("memberCount", { count: org.memberCount })}
              </span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-3 w-3" />
                {t("classroomCount", { count: org.classroomCount })}
              </span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {t("createdOn", { date: formatDate(org.createdAt) })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline-dark"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            {c("edit")}
          </Button>
          <Button
            type="button"
            variant="outline-dark"
            onClick={() => setConfirmOpen(true)}
            className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
          >
            {org.isActive ? (
              <CirclePause className="h-4 w-4" />
            ) : (
              <CirclePlay className="h-4 w-4" />
            )}
            {org.isActive ? t("deactivate") : t("reactivate")}
          </Button>
        </div>
      </div>

      <EditOrganizationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        org={editOpen ? org : null}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {org.isActive
                ? t("confirm.deactivateTitle")
                : t("confirm.reactivateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {org.isActive
                ? t("confirm.deactivateDescription")
                : t("confirm.reactivateDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={toggleActive.isPending}
              className={buttonVariants({ variant: "outline-dark" })}
            >
              {c("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleActive.isPending}
              onClick={(e) => {
                e.preventDefault();
                toggleActive.mutate({
                  id: org.id,
                  data: { isActive: !org.isActive },
                });
              }}
              className={
                org.isActive
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-amber-500 text-slate-900 hover:bg-amber-400"
              }
            >
              {org.isActive
                ? t("confirm.confirmDeactivate")
                : t("confirm.confirmReactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
