"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CirclePause, CirclePlay, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useGetV1OrganizationsId,
  getV1OrganizationsIdQueryKey,
} from "@/kubb/hooks/organizationsHooks/useGetV1OrganizationsId";
import { usePutV1OrganizationsId } from "@/kubb/hooks/organizationsHooks/usePutV1OrganizationsId";
import { usePatchV1OrganizationsIdActive } from "@/kubb/hooks/organizationsHooks/usePatchV1OrganizationsIdActive";
import {
  OrganizationFormFields,
  organizationFormSchema,
  type OrganizationFormValues,
} from "../../_components/organization-form-fields";

export default function OrganizationSettingsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const queryClient = useQueryClient();

  const { data } = useGetV1OrganizationsId(id, {
    query: { enabled: id.length > 0 },
  });
  const org = data?.data;

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: "", slug: "", logo: "" },
  });

  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? "",
      });
    }
  }, [org, form]);

  const updateMutation = usePutV1OrganizationsId({
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
        void queryClient.invalidateQueries({
          queryKey: getV1OrganizationsIdQueryKey(id),
        });
        form.reset({
          name: response.data.name,
          slug: response.data.slug,
          logo: response.data.logo ?? "",
        });
      },
      onError: (err) => {
        const status = (err as { status?: number } | undefined)?.status;
        toast.error(
          status === 409
            ? "Slug já está em uso"
            : err instanceof Error
              ? err.message
              : "Erro ao salvar",
        );
      },
    },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggleActive = usePatchV1OrganizationsIdActive({
    mutation: {
      onSuccess: () => {
        toast.success(
          org?.isActive ? "Organização desativada" : "Organização reativada",
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
          queryKey: getV1OrganizationsIdQueryKey(id),
        });
        setConfirmOpen(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Erro ao atualizar status",
        );
      },
    },
  });

  if (!org) return null;

  const onSubmit = (values: OrganizationFormValues) => {
    updateMutation.mutate({
      id,
      data: {
        name: values.name.trim(),
        slug: values.slug.trim(),
        logo: values.logo ? values.logo : null,
      },
    });
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <Card className="bg-slate-900/60 border-slate-700/60 text-white">
        <CardHeader>
          <CardTitle className="text-base">Detalhes da organização</CardTitle>
          <p className="text-xs text-slate-400">
            A identidade pública da organização. Membros verão estes dados na
            navbar e nos links de turmas.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <OrganizationFormFields form={form} />
            <div className="flex justify-end gap-2 border-t border-slate-700/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  form.reset({
                    name: org.name,
                    slug: org.slug,
                    logo: org.logo ?? "",
                  })
                }
                disabled={!form.formState.isDirty || updateMutation.isPending}
              >
                Descartar
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isDirty || updateMutation.isPending}
                className="bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-red-500/25 text-white">
        <CardHeader>
          <CardTitle className="text-base">Zona de risco</CardTitle>
          <p className="text-xs text-slate-400">
            Desativar congela o acesso de membros e oculta as turmas das buscas.
            Os dados são preservados e podem ser reativados a qualquer momento.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div>
              <div className="text-sm font-medium text-white">
                {org.isActive
                  ? "Desativar organização"
                  : "Reativar organização"}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {org.isActive
                  ? "Membros perderão acesso imediatamente."
                  : "Membros recuperarão o acesso imediatamente."}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              {org.isActive ? (
                <CirclePause className="h-4 w-4" />
              ) : (
                <CirclePlay className="h-4 w-4" />
              )}
              {org.isActive ? "Desativar" : "Reativar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {org.isActive
                ? "Desativar organização?"
                : "Reativar organização?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {org.isActive
                ? `Membros de "${org.name}" perderão acesso imediatamente. Você pode reativar quando quiser.`
                : `Membros de "${org.name}" recuperarão o acesso imediatamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActive.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleActive.isPending}
              onClick={(e) => {
                e.preventDefault();
                toggleActive.mutate({
                  id,
                  data: { isActive: !org.isActive },
                });
              }}
              className={
                org.isActive
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "bg-amber-500 text-slate-900 hover:bg-amber-400"
              }
            >
              {org.isActive ? "Sim, desativar" : "Sim, reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
