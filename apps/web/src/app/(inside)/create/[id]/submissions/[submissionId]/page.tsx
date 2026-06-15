"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRemarkSync } from "react-remark";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Play, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ReferenceSolutionsPanel } from "@/components/challenge/_components/ReferenceSolutionsPanel";
import { AutoReviewStructuredView } from "./_components/AutoReviewStructuredView";
import {
  useGetV1ChallengesChallengeidSubmissionsSubmissionid,
  useGetV1ChallengesId,
  usePutV1ChallengesChallengeidSubmissionsSubmissionidGrade,
  usePostV1ChallengesChallengeidSubmissionsSubmissionidAutoReview,
  getV1ChallengesChallengeidSubmissionsSubmissionidQueryKey,
  getV1ChallengesChallengeidSubmissionsQueryKey,
} from "@/kubb/hooks";

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function AutoReviewMarkdown({ content }: { content: string }) {
  const md = useRemarkSync(content);
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:text-slate-200 prose-p:leading-relaxed prose-headings:text-slate-100 prose-strong:text-slate-100 prose-li:text-slate-200 prose-code:text-amber-400 prose-code:bg-slate-900/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-700">
      {md}
    </div>
  );
}

function AccessDenied() {
  const t = useTranslations("submissions");
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-slate-400">{t("accessDenied")}</p>
    </div>
  );
}

function SubmissionDetailContent() {
  const t = useTranslations("submissions");
  const c = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const challengeId = params.id as string;
  const submissionId = params.submissionId as string;

  const [gradeInput, setGradeInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [autoReviewFeedback, setAutoReviewFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { data: submissionData, isLoading: loadingSub } =
    useGetV1ChallengesChallengeidSubmissionsSubmissionid(
      challengeId,
      submissionId,
      { query: { enabled: !!challengeId && !!submissionId } }
    );

  const { data: challengeData } = useGetV1ChallengesId(challengeId, {
    query: { enabled: !!challengeId },
  });

  const submission = submissionData?.data;
  const challenge = challengeData?.data;

  useEffect(() => {
    if (submission) {
      setGradeInput(submission.grade ?? "");
      setCommentInput(submission.gradingComment ?? "");
    }
  }, [submission]);

  const rerunMutation = usePostV1ChallengesChallengeidSubmissionsSubmissionidAutoReview({
    mutation: {
      onSuccess: (resp) => {
        const generated = resp?.data?.generated;
        setAutoReviewFeedback(
          generated
            ? { type: "success", message: t("autoReview.regenerated") }
            : {
                type: "error",
                message: t("autoReview.noResult"),
              }
        );
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesChallengeidSubmissionsSubmissionidQueryKey(
            challengeId,
            submissionId
          ),
        });
      },
      onError: (err: unknown) => {
        // err from Kubb hooks is an ApiError with status and message
        const status = (err as { status?: number })?.status;
        const message = (err as { message?: string })?.message;

        if (status === 429 && message) {
          // Already includes "Aguarde Xs antes de tentar novamente"
          setAutoReviewFeedback({ type: "error", message });
        } else if (status === 409) {
          setAutoReviewFeedback({
            type: "error",
            message: t("autoReview.alreadyRunning"),
          });
        } else {
          setAutoReviewFeedback({
            type: "error",
            message: message ?? t("autoReview.rerunError"),
          });
        }
      },
    },
  });

  const handleRerunAutoReview = () => {
    setAutoReviewFeedback(null);
    rerunMutation.mutate({ challengeId, submissionId });
  };

  const gradeMutation = usePutV1ChallengesChallengeidSubmissionsSubmissionidGrade({
    mutation: {
      onSuccess: () => {
        setFeedback({ type: "success", message: t("grade.saved") });
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesChallengeidSubmissionsSubmissionidQueryKey(
            challengeId,
            submissionId
          ),
        });
        queryClient.invalidateQueries({
          queryKey: getV1ChallengesChallengeidSubmissionsQueryKey(challengeId),
        });
      },
      onError: (err) => {
        setFeedback({
          type: "error",
          message: err.message ?? t("grade.saveError"),
        });
      },
    },
  });

  const handleSaveGrade = () => {
    setFeedback(null);
    const grade = gradeInput.trim();
    if (!grade) {
      setFeedback({ type: "error", message: t("grade.required") });
      return;
    }
    if (grade.length > 10) {
      setFeedback({ type: "error", message: t("grade.maxLength") });
      return;
    }
    gradeMutation.mutate({
      challengeId,
      submissionId,
      data: {
        grade,
        comment: commentInput.trim() ? commentInput.trim() : null,
      },
    });
  };

  if (loadingSub) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <p className="text-slate-400">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t("detailTitle", {
                student: submission.studentName ?? t("removedUser"),
              })}
            </h1>
            <p className="text-slate-400 text-sm">
              {t("submittedAt", { date: formatDt(submission.submittedAt) })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-200"
              onClick={() =>
                router.push(`/create/${challengeId}/submissions`)
              }
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {c("back")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={() =>
                router.push(
                  `/create/${challengeId}/work-sessions/${submission.workSessionId}/replay`
                )
              }
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              {t("viewReplay")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 lg:col-span-1">
            <h2 className="text-slate-100 font-semibold mb-3">
              {t("submittedCode")}
            </h2>
            <pre className="bg-slate-950 rounded p-3 text-slate-100 text-xs overflow-auto max-h-[420px] whitespace-pre-wrap">
              {submission.code ?? t("noCode")}
            </pre>
            {submission.stdin ? (
              <div className="mt-3">
                <h3 className="text-slate-300 text-sm mb-1">stdin</h3>
                <pre className="bg-slate-950 rounded p-3 text-slate-200 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                  {submission.stdin}
                </pre>
              </div>
            ) : null}
            {submission.stdout ? (
              <div className="mt-3">
                <h3 className="text-slate-300 text-sm mb-1">stdout</h3>
                <pre className="bg-slate-950 rounded p-3 text-slate-200 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                  {submission.stdout}
                </pre>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="text-slate-100 font-semibold">
                {t("autoReview.title")}
              </h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 bg-slate-800 text-slate-200"
                onClick={handleRerunAutoReview}
                disabled={
                  submission.autoReviewStatus === "running" || rerunMutation.isPending
                }
                title={
                  submission.autoReviewStatus === "complete"
                    ? t("autoReview.rerunTitle")
                    : t("autoReview.runTitle")
                }
              >
                {rerunMutation.isPending || submission.autoReviewStatus === "running" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span className="ml-1.5">
                  {submission.autoReviewStatus === "complete"
                    ? t("autoReview.rerun")
                    : t("autoReview.run")}
                </span>
              </Button>
            </div>

            {/* Mutation / 429 feedback */}
            {autoReviewFeedback ? (
              <Alert
                className={
                  autoReviewFeedback.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 mb-3"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300 mb-3"
                }
              >
                <AlertDescription>{autoReviewFeedback.message}</AlertDescription>
              </Alert>
            ) : null}

            {/* State-driven body */}
            {submission.autoReviewStatus === "running" || rerunMutation.isPending ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm italic">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("autoReview.running")}
              </div>
            ) : submission.autoReviewStatus === "complete" &&
              (submission.autoReviewJson || submission.autoReview) ? (
              <>
                <p className="text-slate-500 text-xs mb-2">
                  {t("autoReview.generatedAt", {
                    date: formatDt(submission.autoReviewAt),
                  })}
                </p>
                {submission.autoReviewJson ? (
                  <AutoReviewStructuredView
                    review={submission.autoReviewJson}
                  />
                ) : submission.autoReview ? (
                  <AutoReviewMarkdown content={submission.autoReview} />
                ) : null}
              </>
            ) : submission.autoReviewStatus === "failed" ? (
              <Alert className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <span className="font-medium">{t("autoReview.failed")}</span>{" "}
                  {submission.autoReviewError
                    ? submission.autoReviewError.slice(0, 200)
                    : t("autoReview.unknownError")}
                </AlertDescription>
              </Alert>
            ) : (
              /* pending */
              <p className="text-amber-400/90 text-sm">
                {t("autoReview.pendingHint")}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 lg:col-span-1 space-y-4">
            <ReferenceSolutionsPanel challengeId={challengeId} />

            <div>
              <h2 className="text-slate-100 font-semibold mb-3">
                {t("grade.title")}
              </h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="grade-input" className="text-slate-300 text-sm">
                    {t("grade.label")}
                  </Label>
                  <Input
                    id="grade-input"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    maxLength={10}
                    placeholder={t("grade.placeholder")}
                    className="mt-1 bg-slate-900 border-slate-600 text-slate-100"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="comment-input"
                    className="text-slate-300 text-sm"
                  >
                    {t("grade.commentLabel")}
                  </Label>
                  <Textarea
                    id="comment-input"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    rows={4}
                    placeholder={t("grade.commentPlaceholder")}
                    className="mt-1 bg-slate-900 border-slate-600 text-slate-100"
                  />
                </div>

                {feedback ? (
                  <Alert
                    className={
                      feedback.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    }
                  >
                    <AlertDescription>{feedback.message}</AlertDescription>
                  </Alert>
                ) : null}

                {submission.gradedAt ? (
                  <p className="text-slate-500 text-xs">
                    {t("grade.lastSavedAt", {
                      date: formatDt(submission.gradedAt),
                    })}
                  </p>
                ) : null}

                <Button
                  type="button"
                  onClick={handleSaveGrade}
                  disabled={gradeMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-medium"
                >
                  {gradeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {t("grade.save")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SubmissionDetailPage() {
  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <SubmissionDetailContent />
    </RoleGuard>
  );
}
