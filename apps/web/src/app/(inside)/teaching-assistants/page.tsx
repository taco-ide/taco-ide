"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import {
  useDeleteV1TeachingAssistantsId,
  useGetV1TeachingAssistants,
} from "@/kubb/hooks";
import { ApiError } from "@/lib/apiClient";
import {
  TeachingAssistantFormDialog,
  type TeachingAssistantItem,
} from "./_components/teaching-assistant-form-dialog";

function AccessDenied() {
  const t = useTranslations("teachingAssistants");
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
        <h2 className="text-2xl font-bold text-white">
          {t("accessDenied.title")}
        </h2>
        <p className="text-slate-400">{t("accessDenied.description")}</p>
      </div>
    </div>
  );
}

function TeachingAssistantsManager() {
  const t = useTranslations("teachingAssistants");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetV1TeachingAssistants();
  const assistants = data?.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeachingAssistantItem | null>(null);
  const [deleting, setDeleting] = useState<TeachingAssistantItem | null>(null);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    challenges: string[];
  } | null>(null);

  const deleteMutation = useDeleteV1TeachingAssistantsId({
    mutation: {
      onSuccess: () => {
        toast.success(t("toast.deleted"));
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const first = query.queryKey[0] as { url?: string } | undefined;
            return first?.url?.startsWith("/v1/teaching-assistants") ?? false;
          },
        });
        setDeleting(null);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          const list = err.errors?.challenges;
          setDeleteError({
            message: t("delete.inUse"),
            challenges: Array.isArray(list) ? list : list ? [list] : [],
          });
          return;
        }
        setDeleteError({
          message: err instanceof Error ? err.message : t("toast.deleteError"),
          challenges: [],
        });
      },
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (ta: TeachingAssistantItem) => {
    setEditing(ta);
    setFormOpen(true);
  };
  const openDelete = (ta: TeachingAssistantItem) => {
    setDeleteError(null);
    setDeleting(ta);
  };

  return (
    <div className="min-h-full bg-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Bot className="w-7 h-7 text-amber-400" />
              {t("title")}
            </h1>
            <p className="text-slate-400 mt-1">{t("subtitle")}</p>
          </div>
          <PermissionGuard resource="teachingAssistant" action="create">
            <Button
              onClick={openCreate}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              <Plus className="w-4 h-4" />
              {t("new")}
            </Button>
          </PermissionGuard>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : error ? (
          <p className="text-red-400">
            {error instanceof Error ? error.message : t("loadError")}
          </p>
        ) : assistants.length === 0 ? (
          <Card className="p-10 bg-slate-800 border-slate-700 text-center text-slate-400">
            {t("empty")}
          </Card>
        ) : (
          <div className="space-y-4">
            {assistants.map((ta) => (
              <Card
                key={ta.id}
                className="p-5 bg-slate-800 border-slate-700 text-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white break-words">
                        {ta.alias}
                      </h2>
                      <Badge
                        className={
                          ta.isActive
                            ? "bg-green-500/15 text-green-300 border-green-500/30"
                            : "bg-slate-600/40 text-slate-300 border-slate-500/30"
                        }
                      >
                        {ta.isActive ? t("status.active") : t("status.inactive")}
                      </Badge>
                      {ta.targetAudience && (
                        <Badge className="bg-slate-700 text-slate-200">
                          {ta.targetAudience}
                        </Badge>
                      )}
                    </div>
                    {ta.description && (
                      <p className="text-sm text-slate-400 mt-1">
                        {ta.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      {t("usage", { count: ta.activeChallengeCount })}
                    </p>
                    <p className="text-sm text-slate-300 mt-3 line-clamp-3 whitespace-pre-wrap font-mono">
                      {ta.systemPrompt}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <PermissionGuard resource="teachingAssistant" action="update">
                      <Button
                        size="sm"
                        variant="outline-dark"
                        onClick={() => openEdit(ta)}
                        aria-label={`${c("edit")} ${ta.alias}`}
                      >
                        <Pencil className="w-4 h-4" />
                        {c("edit")}
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard resource="teachingAssistant" action="delete">
                      <Button
                        size="sm"
                        variant="outline-dark"
                        onClick={() => openDelete(ta)}
                        className="text-red-300 hover:text-red-200"
                        aria-label={`${c("delete")} ${ta.alias}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        {c("delete")}
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TeachingAssistantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assistant={editing}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("delete.title", { name: deleting?.alias ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t("delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <p>{deleteError.message}</p>
              {deleteError.challenges.length > 0 && (
                <ul className="list-disc pl-5 mt-2">
                  {deleteError.challenges.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
              {c("cancel")}
            </AlertDialogCancel>
            <Button
              onClick={() =>
                deleting && deleteMutation.mutate({ id: deleting.id })
              }
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {c("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TeachingAssistantsPage() {
  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <TeachingAssistantsManager />
    </RoleGuard>
  );
}
