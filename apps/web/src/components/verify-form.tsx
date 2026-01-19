"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export function VerifyForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
          <h1 className="text-2xl font-bold">Email Verification</h1>
          <p className="text-balance text-muted-foreground">
            {token
              ? "Verifying your email..."
              : "We've sent a verification link to your email. Please check your inbox and click the link to verify your account."}
          </p>
          {email && !token && (
            <p className="text-sm text-muted-foreground mt-2">
              Sent to: <span className="font-medium">{email}</span>
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resendSuccess && (
          <Alert>
            <AlertTitle>Email Sent</AlertTitle>
            <AlertDescription>
              A new verification email has been sent. Please check your inbox.
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
            {isLoading ? "Sending..." : "Resend verification email"}
          </Button>
        )}

        {token && isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        <div className="text-center text-sm">
          <Link href="/auth/login" className="underline underline-offset-4">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
