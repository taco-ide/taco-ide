"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DriveStep } from "driver.js";
import { useUser } from "@/contexts/UserContext";
import {
  usePostV1Classrooms,
  useGetV1OrganizationsIdMembers,
  getV1ClassroomsQueryKey,
} from "@/kubb/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useTutorial } from "@/hooks/useTutorial";
import { useHasMinimumRole } from "@/hooks/usePermission";
import {
  ArrowLeft,
  HelpCircle,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";

const TEACHER_NONE_VALUE = "__none__";

function AccessDenied() {
  const t = useTranslations("classrooms");
  return (
    <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center flex items-center justify-center">
      <div className="text-center space-y-4 px-4">
        <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto" />
        <h2 className="text-2xl font-bold text-white">
          {t("create.accessDenied.title")}
        </h2>
        <p className="text-slate-400">{t("create.accessDenied.description")}</p>
      </div>
    </div>
  );
}

export default function CreateClassroomPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const t = useTranslations("classrooms");
  const c = useTranslations("common");
  const tOnboarding = useTranslations("classroomOnboarding");
  const tour = useTranslations("classroomOnboarding.tour");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherUserId, setTeacherUserId] = useState<string>(TEACHER_NONE_VALUE);

  const orgId = user?.activeOrganizationId ?? null;
  const isCoordinatorPlus = user?.role === "coordinator" || user?.role === "admin";
  const canCreate = useHasMinimumRole("teacher");

  const { data: orgMembersData, isFetched: membersFetched } =
    useGetV1OrganizationsIdMembers(
    orgId ?? "",
    undefined,
    {
      query: { enabled: !!(orgId && isCoordinatorPlus) },
    }
  );
  const teachersInOrg =
    orgMembersData?.data?.filter((m) =>
      ["teacher", "coordinator", "admin"].includes(m.role)
    ) ?? [];
  const showTeacherPicker = isCoordinatorPlus && teachersInOrg.length > 0;

  // Guided tour: what a classroom is -> name it -> pick the lead teacher ->
  // create it and continue on the classroom page (students + challenges).
  const tourSteps = useMemo<DriveStep[]>(() => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="classroom-intro"]',
        popover: {
          title: tour("create.intro.title"),
          description: tour("create.intro.description"),
        },
      },
      {
        element: '[data-tour="classroom-title"]',
        popover: {
          title: tour("create.title.title"),
          description: tour("create.title.description"),
        },
      },
    ];
    if (showTeacherPicker) {
      steps.push({
        element: '[data-tour="classroom-teacher"]',
        popover: {
          title: tour("create.teacher.title"),
          description: tour("create.teacher.description"),
        },
      });
    }
    steps.push({
      element: '[data-tour="classroom-submit"]',
      popover: {
        title: tour("create.submit.title"),
        description: tour("create.submit.description"),
      },
    });
    return steps;
  }, [tour, showTeacherPicker]);

  const { startTour } = useTutorial("classroom-teacher-add", tourSteps, {
    // Wait for the member list so the teacher-picker step is not skipped.
    autoStart: canCreate && !!orgId && (!isCoordinatorPlus || membersFetched),
    nextBtnText: tour("buttons.next"),
    prevBtnText: tour("buttons.back"),
    doneBtnText: tour("buttons.done"),
  });

  const createMutation = usePostV1Classrooms({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getV1ClassroomsQueryKey() });
        router.push(`/classrooms/${data?.data?.id ?? ""}`);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !title.trim()) return;

    createMutation.mutate({
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        organizationId: orgId,
        teacherUserId:
          teacherUserId === TEACHER_NONE_VALUE ? undefined : teacherUserId,
      },
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <RoleGuard minimumRole="teacher" fallback={<AccessDenied />}>
      <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
        <div className="container mx-auto px-4 py-8">
          {!orgId ? (
            <>
              <Link
                href="/explore"
                className="inline-flex items-center text-slate-400 hover:text-slate-200 mb-8 transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToExplore")}
              </Link>
              <div className="max-w-xl mx-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
                {t("create.noActiveOrg")}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <Link
                href="/explore"
                className="inline-flex items-center text-slate-400 hover:text-slate-200 mb-8 transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToExplore")}
              </Link>

              <div className="mb-12 text-center">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-3">
                  {t("create.title")}
                </h1>
                <p className="text-slate-400 text-lg">{t("create.subtitle")}</p>
                <p className="text-slate-500 text-sm mt-2">
                  {t("create.organizationLabel")}{" "}
                  <span className="text-slate-400">
                    {user.activeOrganizationName ?? orgId}
                  </span>
                </p>
              </div>

              <div className="space-y-6 max-w-3xl mx-auto">
                <div
                  data-tour="classroom-intro"
                  className="flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4"
                >
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-sky-100">
                      {tOnboarding("create.intro.title")}
                    </p>
                    <p className="text-sm leading-relaxed text-sky-200/80">
                      {tOnboarding("create.intro.body")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={startTour}
                    className="shrink-0 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
                  >
                    <HelpCircle className="mr-1.5 h-4 w-4" />
                    {tOnboarding("showTutorial")}
                  </Button>
                </div>
                <Card className="p-6 bg-slate-800 border-slate-700">
                  <div className="space-y-4">
                    <div data-tour="classroom-title">
                      <Label className="text-slate-200">
                        {t("create.fields.title.label")}
                      </Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t("create.fields.title.placeholder")}
                        className="bg-slate-900 border-slate-700 text-slate-200"
                        required
                        maxLength={200}
                        disabled={createMutation.isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-slate-200">
                        {t("create.fields.description.label")}
                      </Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t("create.fields.description.placeholder")}
                        className="min-h-[120px] bg-slate-900 border-slate-700 text-slate-200"
                        maxLength={2000}
                        disabled={createMutation.isPending}
                      />
                    </div>
                    {showTeacherPicker && (
                      <div data-tour="classroom-teacher">
                        <Label className="text-slate-200">
                          {t("create.fields.teacher.label")}
                        </Label>
                        <Select
                          value={teacherUserId}
                          onValueChange={setTeacherUserId}
                          disabled={createMutation.isPending}
                        >
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                            <SelectValue
                              placeholder={t("teacher.selectPlaceholder")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem
                              value={TEACHER_NONE_VALUE}
                              className="text-slate-200 focus:bg-slate-700"
                            >
                              {t("teacher.none")}
                            </SelectItem>
                            {teachersInOrg.map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.userId}
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                {m.name} ({m.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("create.fields.teacher.hint")}{" "}
                          {tOnboarding("create.teacherEffect")}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {tOnboarding("create.inviteTeacher.prompt")}{" "}
                          <Link
                            href="/team"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300"
                          >
                            <UserPlus className="h-3 w-3" />
                            {tOnboarding("create.inviteTeacher.link")}
                          </Link>
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {createMutation.isError && (
                <p className="text-sm text-red-400 text-center mt-6 max-w-3xl mx-auto">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : t("create.error")}
                </p>
              )}

              <div className="mt-8 flex justify-end gap-4 max-w-3xl mx-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/explore")}
                  disabled={createMutation.isPending}
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {c("cancel")}
                </Button>
                <Button
                  type="submit"
                  data-tour="classroom-submit"
                  disabled={createMutation.isPending || !title.trim()}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium transition-all duration-200 flex items-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {t("create.submit")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
