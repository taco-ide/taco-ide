"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export function VerifyForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const { verify, resendVerificationEmail, error, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const token = searchParams.get("token");
  const [resendSuccess, setResendSuccess] = useState(false);
  const hasAttemptedVerify = useRef(false);

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token && !hasAttemptedVerify.current) {
      hasAttemptedVerify.current = true;
      verify({});
    }
  }, [token, verify]);

  const handleResend = async () => {
    if (!email) return;
    setResendSuccess(false);
    const success = await resendVerificationEmail(email);
    if (success) {
      setResendSuccess(true);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">{t("verify.title")}</h1>
          <p className="text-balance text-muted-foreground">
            {token ? t("verify.verifying") : t("verify.instructions")}
          </p>
          {email && !token && (
            <p className="text-sm text-muted-foreground mt-2">
              {t.rich("verify.sentTo", {
                email,
                strong: (chunks) => (
                  <span className="font-medium">{chunks}</span>
                ),
              })}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{c("error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resendSuccess && (
          <Alert>
            <AlertTitle>{t("verify.emailSentTitle")}</AlertTitle>
            <AlertDescription>
              {t("verify.emailSentDescription")}
            </AlertDescription>
          </Alert>
        )}

        {!token && email && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isLoading}
          >
            {isLoading ? t("verify.sending") : t("verify.resend")}
          </Button>
        )}

        {token && isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        <div className="text-center text-sm">
          <Link href="/auth/login" className="underline underline-offset-4">
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
