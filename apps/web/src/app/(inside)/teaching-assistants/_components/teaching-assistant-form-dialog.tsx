"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  usePostV1TeachingAssistants,
  usePatchV1TeachingAssistantsId,
  type getV1TeachingAssistants,
} from "@/kubb/hooks";

export type TeachingAssistantItem = Awaited<
  ReturnType<typeof getV1TeachingAssistants>
>["data"][number];

/** Model parameters exposed by the API (same limits as the LLM factory). */
const PARAMS = [
  { key: "temperature", min: 0, max: 2, step: 0.1 },
  { key: "max_tokens", min: 1, max: undefined, step: 1 },
  { key: "top_p", min: 0, max: 1, step: 0.05 },
  { key: "frequency_penalty", min: -2, max: 2, step: 0.1 },
  { key: "presence_penalty", min: -2, max: 2, step: 0.1 },
] as const;

type ParamKey = (typeof PARAMS)[number]["key"];

const optionalNumber = (min: number, max?: number, int = false) =>
  z
    .string()
    .trim()
    .refine(
      (v) => {
        if (v === "") return true;
        const n = Number(v);
        if (!Number.isFinite(n) || n < min) return false;
        if (max !== undefined && n > max) return false;
        return !int || Number.isInteger(n);
      },
      { message: "range" }
    );

const formSchema = z.object({
  alias: z.string().trim().min(1).max(50),
  description: z.string().max(2000),
  systemPrompt: z.string().trim().min(1).max(20000),
  targetAudience: z.string().trim().max(50),
  isActive: z.boolean(),
  temperature: optionalNumber(0, 2),
  max_tokens: optionalNumber(1, undefined, true),
  top_p: optionalNumber(0, 1),
  frequency_penalty: optionalNumber(-2, 2),
  presence_penalty: optionalNumber(-2, 2),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(ta?: TeachingAssistantItem | null): FormValues {
  const params = (ta?.modelParameters ?? {}) as Partial<Record<ParamKey, number>>;
  const num = (k: ParamKey) => (params[k] === undefined ? "" : String(params[k]));
  return {
    alias: ta?.alias ?? "",
    description: ta?.description ?? "",
    systemPrompt: ta?.systemPrompt ?? "",
    targetAudience: ta?.targetAudience ?? "",
    isActive: ta?.isActive ?? true,
    temperature: num("temperature"),
    max_tokens: num("max_tokens"),
    top_p: num("top_p"),
    frequency_penalty: num("frequency_penalty"),
    presence_penalty: num("presence_penalty"),
  };
}

function toModelParameters(values: FormValues) {
  const out: Partial<Record<ParamKey, number>> = {};
  for (const { key } of PARAMS) {
    if (values[key] !== "") out[key] = Number(values[key]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface TeachingAssistantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  assistant?: TeachingAssistantItem | null;
}

export function TeachingAssistantFormDialog({
  open,
  onOpenChange,
  assistant,
}: TeachingAssistantFormDialogProps) {
  const t = useTranslations("teachingAssistants");
  const c = useTranslations("common");
  const queryClient = useQueryClient();
  const isEdit = !!assistant;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(assistant),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(toFormValues(assistant));
  }, [open, assistant, reset]);

  const onSuccess = () => {
    toast.success(isEdit ? t("toast.updated") : t("toast.created"));
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const first = query.queryKey[0] as { url?: string } | undefined;
        return first?.url?.startsWith("/v1/teaching-assistants") ?? false;
      },
    });
    onOpenChange(false);
  };
  const onError = (err: unknown) => {
    const status = (err as { status?: number } | undefined)?.status;
    if (status === 409) {
      setError("alias", { type: "manual", message: t("form.aliasConflict") });
      return;
    }
    toast.error(err instanceof Error ? err.message : t("toast.saveError"));
  };

  const createMutation = usePostV1TeachingAssistants({
    mutation: { onSuccess, onError },
  });
  const updateMutation = usePatchV1TeachingAssistantsId({
    mutation: { onSuccess, onError },
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    const data = {
      alias: values.alias.trim(),
      description: values.description.trim() || null,
      systemPrompt: values.systemPrompt.trim(),
      targetAudience: values.targetAudience.trim() || null,
      isActive: values.isActive,
      modelParameters: toModelParameters(values),
    };
    if (assistant) updateMutation.mutate({ id: assistant.id, data });
    else createMutation.mutate({ data });
  };

  const fieldClass = "bg-slate-950 border-slate-700 text-slate-100";
  const fieldError = (msg?: string) =>
    msg ? <p className="text-sm text-red-400 mt-1">{msg}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("form.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="ta-alias" className="text-slate-200">
              {t("form.alias")}
            </Label>
            <Input
              id="ta-alias"
              {...register("alias")}
              maxLength={50}
              placeholder={t("form.aliasPlaceholder")}
              className={fieldClass}
            />
            {fieldError(
              errors.alias &&
                (errors.alias.type === "manual"
                  ? errors.alias.message
                  : t("form.aliasRequired"))
            )}
          </div>

          <div>
            <Label htmlFor="ta-description" className="text-slate-200">
              {t("form.descriptionLabel")}{" "}
              <span className="text-slate-500">({c("optional")})</span>
            </Label>
            <Input
              id="ta-description"
              {...register("description")}
              className={fieldClass}
            />
          </div>

          <div>
            <Label htmlFor="ta-prompt" className="text-slate-200">
              {t("form.systemPrompt")}
            </Label>
            <Textarea
              id="ta-prompt"
              rows={8}
              {...register("systemPrompt")}
              placeholder={t("form.systemPromptPlaceholder")}
              className={`${fieldClass} font-mono text-sm`}
            />
            <p className="text-xs text-slate-500 mt-1">
              {t("form.systemPromptHelp")}
            </p>
            {fieldError(errors.systemPrompt && t("form.systemPromptRequired"))}
          </div>

          <div>
            <Label htmlFor="ta-audience" className="text-slate-200">
              {t("form.targetAudience")}{" "}
              <span className="text-slate-500">({c("optional")})</span>
            </Label>
            <Input
              id="ta-audience"
              {...register("targetAudience")}
              maxLength={50}
              placeholder={t("form.targetAudiencePlaceholder")}
              className={fieldClass}
            />
          </div>

          <fieldset className="rounded-md border border-slate-700 p-4">
            <legend className="px-1 text-sm text-slate-200">
              {t("form.modelParameters")}
            </legend>
            <p className="text-xs text-slate-500 mb-3">
              {t("form.modelParametersHelp")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PARAMS.map((p) => (
                <div key={p.key}>
                  <Label
                    htmlFor={`ta-${p.key}`}
                    className="text-slate-300 text-xs"
                  >
                    {t(`form.params.${p.key}`)}
                  </Label>
                  <Input
                    id={`ta-${p.key}`}
                    type="number"
                    inputMode="decimal"
                    step={p.step}
                    min={p.min}
                    max={p.max}
                    {...register(p.key)}
                    className={fieldClass}
                  />
                  {fieldError(
                    errors[p.key] &&
                      t("form.paramRange", {
                        min: p.min,
                        max: p.max ?? "∞",
                      })
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          <label
            htmlFor="ta-active"
            className="flex items-center gap-2 text-sm text-slate-200"
          >
            <input
              id="ta-active"
              type="checkbox"
              {...register("isActive")}
              className="h-4 w-4 accent-amber-500"
            />
            {t("form.isActive")}
          </label>
          {isEdit && assistant && assistant.activeChallengeCount > 0 && (
            <p className="text-xs text-amber-300">
              {t("form.deactivateWarning", {
                count: assistant.activeChallengeCount,
              })}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline-dark"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {c("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? c("saving") : c("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
