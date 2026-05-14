"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
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
import { usePutV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/usePutV1OrganizationsId";
import { getV1OrganizationsIdQueryKey } from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import {
  OrganizationFormFields,
  organizationFormSchema,
  type OrganizationFormValues,
} from "./organization-form-fields";

interface EditableOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: EditableOrg | null;
}

export function EditOrganizationDialog({
  open,
  onOpenChange,
  org,
}: EditOrganizationDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: "", slug: "", logo: "" },
  });

  useEffect(() => {
    if (open && org) {
      form.reset({
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? "",
      });
    }
  }, [open, org, form]);

  const mutation = usePutV1OrganizationsId({
    mutation: {
      onSuccess: (response) => {
        toast.success(`Organização "${response.data.name}" atualizada`);
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return (
              first?.url === "/v1/organizations/" ||
              first?.url === "/v1/organizations/:id"
            );
          },
        });
        if (org) {
          void queryClient.invalidateQueries({
            queryKey: getV1OrganizationsIdQueryKey(org.id),
          });
        }
        onOpenChange(false);
      },
      onError: (err) => {
        const status = (err as { status?: number } | undefined)?.status;
        const message =
          err instanceof Error ? err.message : "Erro ao atualizar organização";
        toast.error(status === 409 ? "Slug já está em uso" : message);
      },
    },
  });

  const onSubmit = (values: OrganizationFormValues) => {
    if (!org) return;
    mutation.mutate({
      id: org.id,
      data: {
        name: values.name.trim(),
        slug: values.slug.trim(),
        logo: values.logo ? values.logo : null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar organização</DialogTitle>
          <DialogDescription className="text-slate-400">
            Atualize a identidade pública desta organização.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <OrganizationFormFields form={form} />
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
