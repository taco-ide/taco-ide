"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginFormData, loginSchema } from "@/lib/schemas";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const { login, error, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const sessionExpiredReason =
    searchParams.get("reason") === "session_expired";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    await login(data);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold">{t("login.title")}</h1>
            <p className="text-balance text-muted-foreground">
              {t("login.subtitle")}
            </p>
          </div>
          {sessionExpiredReason && (
            <Alert>
              <AlertTitle>{t("login.sessionExpired.title")}</AlertTitle>
              <AlertDescription>
                {t("login.sessionExpired.description")}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">{c("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">{t("fields.password")}</Label>
              <Link
                href="/auth/reset-password"
                className="ml-auto text-sm underline-offset-2 hover:underline"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
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
            {isLoading ? t("login.submitting") : t("login.submit")}
          </Button>
          <div className="text-center text-sm">
            {t("login.noAccount")}{" "}
            <Link href="/auth/signup" className="underline underline-offset-4">
              {t("login.signUpLink")}
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
