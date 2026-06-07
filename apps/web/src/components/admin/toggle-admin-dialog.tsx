"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { usePatchV1UsersIdPlatformAdmin } from "@/kubb/hooks/usersHooks/usePatchV1UsersIdPlatformAdmin";
import { getV1UsersQueryKey } from "@/kubb/hooks/usersHooks/useGetV1Users";
import { getV1UsersMeQueryKey } from "@/kubb/hooks/usersHooks/useGetV1UsersMe";
import { AvatarSquare } from "./avatar-square";

export interface ToggleAdminTarget {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

interface ToggleAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ToggleAdminTarget | null;
  currentUserId: string;
}

export function ToggleAdminDialog({
  open,
  onOpenChange,
  target,
  currentUserId,
}: ToggleAdminDialogProps) {
  const t = useTranslations("adminShared");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const [soloLock, setSoloLock] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSoloLock(false);
      setErrorMessage(null);
    }
  }, [open, target?.id]);

  const mutation = usePatchV1UsersIdPlatformAdmin({
    mutation: {
      onSuccess: () => {
        toast.success(
          target?.isPlatformAdmin
            ? t("toggleAdmin.toast.removed")
            : t("toggleAdmin.toast.promoted"),
        );
        void queryClient.invalidateQueries({
          queryKey: [getV1UsersQueryKey({ q: "" })[0]],
        });
        void queryClient.invalidateQueries({
          queryKey: getV1UsersMeQueryKey(),
        });
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          // Backend blocks the only platform admin from demoting itself.
          setSoloLock(true);
          setErrorMessage(null);
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : t("toggleAdmin.error.generic"),
        );
      },
    },
  });

  if (!target) return null;

  const promoting = !target.isPlatformAdmin;
  const isSelf = target.id === currentUserId;

  if (soloLock) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("toggleAdmin.soloLock.title")}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("toggleAdmin.soloLock.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-sm text-slate-300">
              {t("toggleAdmin.soloLock.body")}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {t("toggleAdmin.soloLock.acknowledge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleConfirm = () => {
    setErrorMessage(null);
    mutation.mutate({
      id: target.id,
      data: { isPlatformAdmin: !target.isPlatformAdmin },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {promoting
              ? t("toggleAdmin.promote.title")
              : t("toggleAdmin.remove.title")}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {promoting
              ? t("toggleAdmin.promote.description")
              : t("toggleAdmin.remove.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-slate-700/60 bg-slate-950/40 p-3">
            <AvatarSquare name={target.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                {target.name}
              </div>
              <div className="truncate text-xs text-slate-400">
                {target.email}
              </div>
            </div>
          </div>

          {promoting ? (
            <div className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t.rich("toggleAdmin.promote.warning", {
                  strong: (chunks) => (
                    <strong className="text-amber-100">{chunks}</strong>
                  ),
                })}
              </p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t.rich("toggleAdmin.remove.warning", {
                  name: target.name,
                  code: (chunks) => <code>{chunks}</code>,
                })}
                {isSelf && (
                  <span className="mt-1 block text-sky-100">
                    {t("toggleAdmin.remove.selfNotice")}
                  </span>
                )}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline-dark"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {c("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className={
              promoting
                ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                : "border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
            }
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : promoting ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            {promoting
              ? t("toggleAdmin.promote.confirm")
              : t("toggleAdmin.remove.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
