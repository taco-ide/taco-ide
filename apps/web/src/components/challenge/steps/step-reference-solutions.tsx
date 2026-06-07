"use client";

import { useEffect, useState } from "react";
import { useWatch, useFormContext } from "react-hook-form";
import { useTranslations, useFormatter } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCw, Pencil, Trash2 } from "lucide-react";
import {
  useGetV1ChallengesChallengeidReferenceSolutions,
  usePostV1ChallengesChallengeidReferenceSolutionsKindRegenerate,
  usePutV1ChallengesChallengeidReferenceSolutionsKind,
  useDeleteV1ChallengesChallengeidReferenceSolutionsKind,
  getV1ChallengesChallengeidReferenceSolutionsQueryKey,
} from "@/kubb/hooks";
import { useQueryClient } from "@tanstack/react-query";

interface StepReferenceSolutionsProps {
  challengeId: string | undefined;
  mode: "create" | "edit";
}

type Kind = "brute_force" | "refined";
const KINDS: Kind[] = ["brute_force", "refined"];

function getStatusBadgeColor(
  status: string
): "pending" | "running" | "complete" | "failed" {
  if (
    status === "pending" ||
    status === "running" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }
  return "pending";
}

function StatusBadge({
  status,
}: {
  status: "pending" | "running" | "complete" | "failed";
}) {
  const t = useTranslations("challenge");
  const colors: Record<
    "pending" | "running" | "complete" | "failed",
    string
  > = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    running: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    complete: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    failed: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs border ${
        colors[status]
      }`}
    >
      {t(`referenceSolutions.status.${status}`)}
    </span>
  );
}

function ReferenceKindCard({
  kind,
  challengeId,
  data,
  isLoading,
}: {
  kind: Kind;
  challengeId: string;
  data:
    | {
        kind: string;
        language: string;
        code: string | null;
        status: string;
        error: string | null;
        createdBy: string;
        generatedAt: string | null;
        updatedAt: string;
      }
    | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("challenge");
  const c = useTranslations("common");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [editingCode, setEditingCode] = useState(false);
  const [editCode, setEditCode] = useState(data?.code ?? "");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Sync the editor buffer with the latest code when not actively editing,
  // so a background regeneration that arrives via polling doesn't get
  // silently overwritten the next time the user clicks "Editar".
  useEffect(() => {
    if (!editingCode) {
      setEditCode(data?.code ?? "");
    }
  }, [data?.code, editingCode]);

  const regenerateMutation =
    usePostV1ChallengesChallengeidReferenceSolutionsKindRegenerate({
      mutation: {
        onSuccess: () => {
          setFeedback({
            type: "success",
            message: t("referenceSolutions.card.feedback.regenerated"),
          });
          queryClient.invalidateQueries({
            queryKey: getV1ChallengesChallengeidReferenceSolutionsQueryKey(
              challengeId
            ),
          });
        },
        onError: (err: any) => {
          const status = err?.status;
          const message = err?.message;
          if (status === 409) {
            setFeedback({
              type: "error",
              message: t("referenceSolutions.card.feedback.alreadyRunning"),
            });
          } else if (status === 429) {
            setFeedback({
              type: "error",
              message: message || t("referenceSolutions.card.feedback.rateLimited"),
            });
          } else {
            setFeedback({
              type: "error",
              message:
                message || t("referenceSolutions.card.feedback.regenerateError"),
            });
          }
        },
      },
    });

  const saveMutation = usePutV1ChallengesChallengeidReferenceSolutionsKind({
    mutation: {
      onSuccess: () => {
        setEditingCode(false);
        setFeedback({
          type: "success",
          message: t("referenceSolutions.card.feedback.savedManually"),
        });
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesChallengeidReferenceSolutionsQueryKey(
            challengeId
          ),
        });
      },
      onError: (err: any) => {
        setFeedback({
          type: "error",
          message: err?.message || t("referenceSolutions.card.feedback.saveError"),
        });
      },
    },
  });

  const deleteMutation = useDeleteV1ChallengesChallengeidReferenceSolutionsKind({
    mutation: {
      onSuccess: () => {
        setFeedback({
          type: "success",
          message: t("referenceSolutions.card.feedback.removed"),
        });
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesChallengeidReferenceSolutionsQueryKey(
            challengeId
          ),
        });
      },
      onError: (err: any) => {
        setFeedback({
          type: "error",
          message: err?.message || t("referenceSolutions.card.feedback.removeError"),
        });
      },
    },
  });

  const status = getStatusBadgeColor(data?.status ?? "pending");

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-200">
            {t(`referenceSolutions.kind.${kind}`)}
          </h3>
          <StatusBadge status={status} />
          {data && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 text-slate-300 rounded">
              {data.createdBy === "manual"
                ? t("referenceSolutions.card.source.manual")
                : t("referenceSolutions.card.source.ai")}
            </span>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <Alert
          className={
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }
        >
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      {/* Body */}
      {status === "complete" && data?.code ? (
        <div className="space-y-3">
          <p className="text-slate-500 text-xs">
            {t("referenceSolutions.card.generatedAt", {
              date: data.generatedAt
                ? format.dateTime(new Date(data.generatedAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—",
            })}
          </p>

          {editingCode ? (
            <div className="space-y-2">
              <Textarea
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="font-mono text-xs bg-slate-950 border-slate-700 text-slate-100"
                rows={12}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    saveMutation.mutate({
                      challengeId,
                      kind,
                      data: { code: editCode },
                    });
                  }}
                  disabled={saveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saveMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  )}
                  {c("save")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingCode(false);
                    setEditCode(data.code ?? "");
                  }}
                  className="border-slate-600 bg-slate-800 text-slate-200"
                >
                  {c("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <pre className="font-mono text-xs bg-slate-950 border border-slate-700 rounded p-3 overflow-auto max-h-64 text-slate-100">
                {data.code}
              </pre>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    regenerateMutation.mutate({
                      challengeId,
                      kind,
                    });
                  }}
                  disabled={
                    regenerateMutation.isPending ||
                    data?.status === "running"
                  }
                  className="border-slate-600 bg-slate-800 text-slate-200 flex-1"
                >
                  {regenerateMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  )}
                  <RotateCw className="w-3.5 h-3.5 mr-1" />
                  {t("referenceSolutions.card.actions.regenerate")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingCode(true)}
                  disabled={data?.status === "running"}
                  className="border-slate-600 bg-slate-800 text-slate-200 flex-1"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  {c("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(t("referenceSolutions.card.confirmRemove"))) {
                      deleteMutation.mutate({
                        challengeId,
                        kind,
                      });
                    }
                  }}
                  disabled={data?.status === "running"}
                  className="border-rose-600/50 bg-slate-800 text-rose-300 hover:bg-rose-500/10 flex-1"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {t("referenceSolutions.card.actions.remove")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : status === "pending" || !data ? (
        <div className="space-y-3">
          <p className="text-amber-400/90 text-sm">
            {t("referenceSolutions.card.empty")}
          </p>
          <Button
            size="sm"
            onClick={() => {
              regenerateMutation.mutate({
                challengeId,
                kind,
              });
            }}
            disabled={regenerateMutation.isPending}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {regenerateMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            )}
            {t("referenceSolutions.card.actions.generateNow")}
          </Button>
        </div>
      ) : status === "running" ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <p className="text-slate-400 text-sm">{t("referenceSolutions.running")}</p>
        </div>
      ) : status === "failed" ? (
        <div className="space-y-3">
          <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300">
            <AlertDescription>
              {data?.error && data.error.length > 0
                ? data.error.slice(0, 200)
                : t("referenceSolutions.unknownError")}
            </AlertDescription>
          </Alert>
          <Button
            size="sm"
            onClick={() => {
              regenerateMutation.mutate({
                challengeId,
                kind,
              });
            }}
            disabled={regenerateMutation.isPending}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {regenerateMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            )}
            {c("retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StepReferenceSolutions({
  challengeId,
  mode,
}: StepReferenceSolutionsProps) {
  const t = useTranslations("challenge");
  const { register } = useFormContext();

  const { data: refSolsData, isLoading: refSolsLoading } =
    useGetV1ChallengesChallengeidReferenceSolutions(challengeId ?? "", {
      query: {
        enabled: mode === "edit" && !!challengeId,
        refetchInterval: (query) => {
          const list = query.state.data?.data;
          if (!Array.isArray(list)) return false;
          return list.some((r) => r.status === "running") ? 3000 : false;
        },
      },
    });

  const refSolutions = refSolsData?.data ?? [];
  const refSolsMap = Object.fromEntries(
    refSolutions.map((r) => [r.kind, r])
  );

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            {t("referenceSolutions.title")}
          </h2>
          <p className="text-slate-400">
            {mode === "create"
              ? t("referenceSolutions.subtitle.create")
              : t("referenceSolutions.subtitle.edit")}
          </p>
        </div>

        <div className="flex flex-row items-start space-x-3 rounded-md border border-slate-700 p-4 lg:max-w-md">
          <input
            type="checkbox"
            {...register("generateReferenceSolutions")}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="space-y-1 flex-1">
            <Label className="text-slate-200 block">
              {mode === "create"
                ? t("referenceSolutions.toggle.label.create")
                : t("referenceSolutions.toggle.label.edit")}
            </Label>
            <p className="text-xs text-slate-400">
              {mode === "create"
                ? t("referenceSolutions.toggle.description.create")
                : t("referenceSolutions.toggle.description.edit")}
            </p>
          </div>
        </div>
      </div>

      {mode === "create" && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-300">
          <AlertDescription>
            {t("referenceSolutions.createNote")}
          </AlertDescription>
        </Alert>
      )}

      {mode === "edit" && challengeId && (
        <div className="space-y-4">
          <h3 className="text-slate-300 font-semibold text-sm">
            {t("referenceSolutions.byKind")}
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {KINDS.map((kind) => (
              <ReferenceKindCard
                key={kind}
                kind={kind}
                challengeId={challengeId}
                data={refSolsMap[kind]}
                isLoading={refSolsLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
