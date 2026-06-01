"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/apiClient";
import { usePostV1OrganizationsIdInvitations } from "@/kubb/hooks/organizationsHooks/usePostV1OrganizationsIdInvitations";
import { getV1OrganizationsIdInvitationsQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsIdInvitations";
import type { AdminRole } from "@/components/admin/role-badge";
import { getRoleLabel } from "@/components/admin/role-badge";

interface CreateInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

// Explicit invitations may grant any role, including admin. This differs from
// email-domain auto-link rules (capped at coordinator — see F10). Here the
// admin is intentionally selecting a target role per invite.
const ROLE_OPTIONS: AdminRole[] = [
  "student",
  "teacher",
  "coordinator",
  "admin",
];

const DEFAULT_ROLE: AdminRole = "teacher";

const emailSchema = z.string().trim().toLowerCase().email();

export function CreateInvitationDialog({
  open,
  onOpenChange,
  organizationId,
}: CreateInvitationDialogProps) {
  const t = useTranslations("adminInvitations");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>(DEFAULT_ROLE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes so the next opening starts fresh.
      setEmail("");
      setRole(DEFAULT_ROLE);
      setError(null);
    }
  }, [open]);

  const createMutation = usePostV1OrganizationsIdInvitations({
    mutation: {
      onSuccess: (response) => {
        toast.success(t("toast.sent", { email: response.data.email }));
        void queryClient.invalidateQueries({
          queryKey: [getV1OrganizationsIdInvitationsQueryKey(organizationId)[0]],
        });
        onOpenChange(false);
      },
      onError: (err) => {
        const apiError = err as unknown as ApiError | undefined;
        const status = apiError?.status;
        const message =
          err instanceof Error ? err.message : t("toast.sendError");

        if (status === 409) {
          // Backend returns 409 for both duplicate-pending and
          // user-already-a-member; surface a friendly toast either way.
          const isDuplicate = /já existe|pending invitation/i.test(message);
          const isMember = /já[\s\S]*membro|already a member/i.test(message);
          if (isDuplicate) {
            setError(t("toast.duplicatePending"));
            toast.error(t("toast.duplicatePending"));
            return;
          }
          if (isMember) {
            setError(t("toast.alreadyMember"));
            toast.error(t("toast.alreadyMember"));
            return;
          }
          setError(message);
          toast.error(message);
          return;
        }

        setError(message);
        toast.error(message);
      },
    },
  });

  function submit() {
    if (createMutation.isPending) return;

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(t("invalidEmail"));
      return;
    }

    setError(null);
    createMutation.mutate({
      id: organizationId,
      data: {
        email: parsed.data,
        role,
      },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-700 bg-slate-900 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-slate-300">
              {c("email")}
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("dialog.emailPlaceholder")}
              className="border-slate-700 bg-slate-950/60 text-white placeholder:text-slate-500"
              aria-invalid={error ? true : undefined}
              disabled={createMutation.isPending}
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-slate-300">
              {t("dialog.roleLabel")}
            </Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as AdminRole)}
              disabled={createMutation.isPending}
            >
              <SelectTrigger
                id="invite-role"
                className="border-slate-700 bg-slate-950/60 text-white"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-900 text-white">
                {ROLE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getRoleLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              {c("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {t("dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
