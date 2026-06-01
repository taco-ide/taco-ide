"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignupFormData, signupSchema } from "@/lib/schemas";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const { signup, error, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    await signup(data);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold">{t("signup.title")}</h1>
            <p className="text-balance text-muted-foreground">
              {t("signup.subtitle")}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">{t("fields.fullName")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("signup.namePlaceholder")}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
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
            <Label htmlFor="password">{t("fields.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("signup.passwordPlaceholder")}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">{t("fields.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("signup.confirmPasswordPlaceholder")}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
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
            {isLoading ? t("signup.submitting") : t("signup.submit")}
          </Button>
          <div className="text-center text-sm">
            {t("signup.haveAccount")}{" "}
            <Link href="/auth/login" className="underline underline-offset-4">
              {t("signup.signInLink")}
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
