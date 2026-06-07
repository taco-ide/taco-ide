"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { usePutV1UsersMe } from "@/kubb/hooks/usersHooks/usePutV1UsersMe";
import { getV1UsersMeQueryKey } from "@/kubb/hooks/usersHooks/useGetV1UsersMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, User, Shield } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  image: z.string().url("URL invalida").nullable().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const roleLabelKeys: Record<string, string> = {
  student: "roles.student",
  teacher: "roles.teacher",
  coordinator: "roles.coordinator",
  admin: "roles.admin",
};

export default function ProfilePage() {
  const t = useTranslations("profile");
  const c = useTranslations("common");
  const { user, isLoading: isUserLoading } = useUser();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const mutation = usePutV1UsersMe({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1UsersMeQueryKey() });
        setFeedback({ type: "success", message: t("feedback.updateSuccess") });
      },
      onError: (err) => {
        setFeedback({
          type: "error",
          message: err.message ?? t("feedback.updateError"),
        });
      },
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? "",
      image: user?.image ?? "",
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    setFeedback(null);
    mutation.mutate({
      data: {
        name: data.name,
        image: data.image || undefined,
      },
    });
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-400">{t("loadError")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
            {t("title")}
          </h1>
          <p className="text-slate-400">{t("subtitle")}</p>
        </div>

        {/* Avatar & Info */}
        <Card className="mb-6 bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xl font-bold">
                  {user.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold text-white">{user.name}</h2>
                <p className="text-slate-400">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Organization (readonly info) */}
        <Card className="mb-6 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-yellow-400" />
              {t("orgRole.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t("orgRole.currentRole")}</span>
              {user.role ? (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  {roleLabelKeys[user.role] ? t(roleLabelKeys[user.role]) : user.role}
                </Badge>
              ) : (
                <span className="text-slate-500 text-sm">{t("orgRole.noActiveOrg")}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t("orgRole.activeOrg")}</span>
              <span className="text-slate-300 text-sm">
                {user.activeOrganizationName ?? t("orgRole.none")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-yellow-400" />
              {t("editForm.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-300">
                  {c("email")}
                </Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="name" className="text-slate-300">
                  {c("name")}
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  className="bg-slate-900 border-slate-700 text-slate-200"
                  placeholder={t("editForm.namePlaceholder")}
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="image" className="text-slate-300">
                  {t("editForm.imageLabel")}
                </Label>
                <Input
                  id="image"
                  {...register("image")}
                  className="bg-slate-900 border-slate-700 text-slate-200"
                  placeholder={t("editForm.imagePlaceholder")}
                />
                {errors.image && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors.image.message}
                  </p>
                )}
              </div>

              {feedback && (
                <Alert
                  className={
                    feedback.type === "success"
                      ? "border-green-500/30 bg-green-500/10 text-green-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }
                >
                  <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={mutation.isPending || !isDirty}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {c("save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
