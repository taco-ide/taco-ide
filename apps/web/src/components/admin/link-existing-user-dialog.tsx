"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Link2, Loader2, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetV1Users } from "@/kubb/hooks/usersHooks/useGetV1Users";
import { usePostV1OrganizationsIdMembers } from "@/kubb/hooks/organizationsHooks/usePostV1OrganizationsIdMembers";
import { getV1OrganizationsIdMembersQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdMembers";
import { getV1OrganizationsIdQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { getV1OrganizationsQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1Organizations";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/apiClient";
import { AvatarSquare } from "./avatar-square";
import { RoleSelect } from "./role-select";
import type { AdminRole } from "./role-badge";

interface LinkExistingUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

interface PickedUser {
  id: string;
  name: string;
  email: string;
}

export function LinkExistingUserDialog({
  open,
  onOpenChange,
  organizationId,
}: LinkExistingUserDialogProps) {
  const t = useTranslations("adminShared");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [picked, setPicked] = useState<PickedUser | null>(null);
  const [role, setRole] = useState<AdminRole>("teacher");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setPicked(null);
      setRole("teacher");
      setErrorMessage(null);
    }
  }, [open]);

  const trimmed = debouncedSearch.trim();
  const queryEnabled = trimmed.length >= 2;

  const { data, isLoading, isFetching, error } = useGetV1Users(
    { q: trimmed },
    { query: { enabled: queryEnabled } },
  );

  const candidates = useMemo(() => {
    const list = data?.data ?? [];
    return list.filter(
      (u) => !u.memberships.some((m) => m.organizationId === organizationId),
    );
  }, [data, organizationId]);

  const mutation = usePostV1OrganizationsIdMembers({
    mutation: {
      onSuccess: () => {
        toast.success(t("link.toast.success"));
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdMembersQueryKey(organizationId),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdQueryKey(organizationId),
        });
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsQueryKey(),
        });
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setErrorMessage(t("link.error.alreadyMember"));
            return;
          }
          if (err.status === 404) {
            setErrorMessage(t("link.error.userNotFound"));
            return;
          }
          setErrorMessage(err.message);
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : t("link.error.generic"),
        );
      },
    },
  });

  const handleConfirm = () => {
    if (!picked) return;
    setErrorMessage(null);
    mutation.mutate({
      id: organizationId,
      data: { email: picked.email, role },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("link.title")}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("link.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="link-user-search" className="text-slate-300 text-xs">
              {t("link.searchLabel")}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="link-user-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPicked(null);
                }}
                placeholder={t("link.searchPlaceholder")}
                autoFocus
                className="bg-slate-950/40 border-slate-700 pl-9 pr-9 text-white placeholder:text-slate-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPicked(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
                  aria-label={t("link.clearSearch")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!queryEnabled && (
              <p className="text-[11px] text-slate-500">
                {t("link.minChars")}
              </p>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-950/40">
            {!queryEnabled ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                {t("link.hintSearch")}
              </div>
            ) : isLoading || isFetching ? (
              <div className="flex items-center justify-center px-4 py-6 text-xs text-slate-400">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {t("link.searching")}
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center text-xs text-rose-300">
                {t("link.searchFailed")}
              </div>
            ) : candidates.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                {t("link.noCandidates")}
              </div>
            ) : (
              <ul className="divide-y divide-slate-700/60">
                {candidates.map((u) => {
                  const isPicked = picked?.id === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setPicked({ id: u.id, name: u.name, email: u.email })
                        }
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          isPicked
                            ? "bg-amber-500/10"
                            : "hover:bg-slate-800/50",
                        )}
                      >
                        <AvatarSquare name={u.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {u.name}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {u.email}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {t("link.orgCount", {
                            count: u.memberships.length,
                          })}
                        </span>
                        {isPicked && (
                          <Check className="h-4 w-4 shrink-0 text-amber-300" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">
              {t("link.roleLabel")}
            </Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>

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
            disabled={!picked || mutation.isPending}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {t("link.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
