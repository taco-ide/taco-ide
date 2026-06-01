"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
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
import { usePostV1Organizations } from "@/kubb/hooks/organizationsHooks/usePostV1Organizations";
import {
  OrganizationFormFields,
  organizationFormSchema,
  type OrganizationFormValues,
} from "./organization-form-fields";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const t = useTranslations("adminOrgs");
  const c = useTranslations("common");
  const queryClient = useQueryClient();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: "", slug: "", logo: "" },
  });

  useEffect(() => {
    if (open) form.reset({ name: "", slug: "", logo: "" });
  }, [open, form]);

  const mutation = usePostV1Organizations({
    mutation: {
      onSuccess: (response) => {
        toast.success(t("toast.created", { name: response.data.name }));
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return first?.url === "/v1/organizations/";
          },
        });
        onOpenChange(false);
      },
      onError: (err) => {
        const status = (err as { status?: number } | undefined)?.status;
        if (status === 409) {
          form.setError(
            "slug",
            {
              type: "manual",
              message: t("slugConflict"),
            },
            { shouldFocus: true },
          );
          return;
        }
        const message =
          err instanceof Error ? err.message : t("toast.createErrorFallback");
        toast.error(t("toast.createError", { message }));
      },
    },
  });

  const onSubmit = (values: OrganizationFormValues) => {
    mutation.mutate({
      data: {
        name: values.name.trim(),
        slug: values.slug.trim(),
        ...(values.logo ? { logo: values.logo } : {}),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("createDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <OrganizationFormFields form={form} autoSlug />
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {c("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t("createDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
