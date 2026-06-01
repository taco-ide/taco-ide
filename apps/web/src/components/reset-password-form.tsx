"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/schemas";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const { requestPasswordReset, resetPassword, error, isLoading } = useAuth();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Check if we have a token in the URL (from Better Auth reset link)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      setStep("reset");
    }
  }, []);

  // Form for requesting password reset
  const requestForm = useForm({
    resolver: zodResolver(requestPasswordResetSchema),
  });

  // Form for resetting password
  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Send reset email request
  const onRequestSubmit = async (data: { email: string }) => {
    const success = await requestPasswordReset(data.email);

    if (success) {
      setRequestSuccess(true);
    }
  };

  // Reset password with new password
  const onResetSubmit = async (data: {
    code?: string;
    password: string;
    confirmPassword: string;
  }) => {
    await resetPassword(data.code || "", data.password, data.confirmPassword);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Title and description */}
      <div className="flex flex-col items-center text-center mb-6">
        <h1 className="text-2xl font-bold">
          {step === "request"
            ? t("resetPassword.requestTitle")
            : t("resetPassword.resetTitle")}
        </h1>
        <p className="text-balance text-muted-foreground">
          {step === "request"
            ? t("resetPassword.requestSubtitle")
            : t("resetPassword.resetSubtitle")}
        </p>
      </div>

      {/* Form for requesting reset */}
      {step === "request" && !requestSuccess && (
        <form
          className="flex flex-col gap-6"
          onSubmit={requestForm.handleSubmit(onRequestSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">{c("email")}</Label>
            <Input
              id="email"
              type="email"
              {...requestForm.register("email")}
              placeholder="your@email.com"
            />
            {requestForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {String(requestForm.formState.errors.email.message)}
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{c("error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? t("resetPassword.sending")
              : t("resetPassword.sendLink")}
          </Button>

          <div className="text-center text-sm">
            <Link href="/auth/login" className="underline underline-offset-4">
              {t("backToLogin")}
            </Link>
          </div>
        </form>
      )}

      {/* Success message after requesting reset */}
      {step === "request" && requestSuccess && (
        <div className="flex flex-col gap-6">
          <Alert>
            <AlertTitle>{t("resetPassword.checkEmailTitle")}</AlertTitle>
            <AlertDescription>
              {t("resetPassword.checkEmailDescription")}
            </AlertDescription>
          </Alert>

          <div className="text-center text-sm">
            <Link href="/auth/login" className="underline underline-offset-4">
              {t("backToLogin")}
            </Link>
          </div>
        </div>
      )}

      {/* Form for resetting password */}
      {step === "reset" && (
        <form
          className="flex flex-col gap-6"
          onSubmit={resetForm.handleSubmit(onResetSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="password">{t("fields.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              {...resetForm.register("password")}
            />
            {resetForm.formState.errors.password && (
              <p className="text-sm text-destructive">
                {String(resetForm.formState.errors.password.message)}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">
              {t("fields.confirmNewPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              {...resetForm.register("confirmPassword")}
            />
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {String(resetForm.formState.errors.confirmPassword.message)}
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{c("error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? t("resetPassword.resetting")
              : t("resetPassword.resetSubmit")}
          </Button>

          <div className="text-center text-sm">
            <Link href="/auth/login" className="underline underline-offset-4">
              {t("backToLogin")}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
