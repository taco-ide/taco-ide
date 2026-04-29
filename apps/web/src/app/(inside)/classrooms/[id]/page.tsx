"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  useGetV1ClassroomsId,
  usePutV1ClassroomsId,
  usePostV1ClassroomsIdEnroll,
  usePostV1ClassroomsIdUnenroll,
  useGetV1OrganizationsIdMembers,
  useGetV1Challenges,
  usePatchV1ChallengesId,
  getV1ClassroomsIdQueryKey,
  getV1ChallengesQueryKey,
} from "@/kubb/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Pencil,
  Check,
  X,
  BookOpen,
  Plus,
} from "lucide-react";

const TEACHER_NONE_VALUE = "__none__";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="my-10 flex items-center gap-4">
      <div className="h-px flex-1 bg-slate-800" />
      <span className="text-slate-400 font-medium shrink-0">{label}</span>
      <div className="h-px flex-1 bg-slate-800" />
    </div>
  );
}

export default function ClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const id = params.id as string;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [enrollSelectValue, setEnrollSelectValue] = useState("");

  const {
    data: classroomData,
    isLoading: classroomLoading,
    error: classroomError,
  } = useGetV1ClassroomsId(id, {});

  const classroom = classroomData?.data;
  const orgId = classroom?.organizationId ?? null;
  const isCoordinatorPlus =
    user?.role === "coordinator" || user?.role === "admin";
  const isLeadTeacher = user?.id === classroom?.teacherUserId;
  const canManageEnrollments = isCoordinatorPlus || isLeadTeacher;
  const canEditMetadata = isCoordinatorPlus || isLeadTeacher;
  const canSetTeacher = isCoordinatorPlus;
  const canAssignChallenges = isCoordinatorPlus || isLeadTeacher;

  const { data: classroomChallengesData } = useGetV1Challenges(
    { classroomId: id, page: 1, perPage: 50 },
    { query: { enabled: !!id } }
  );
  const { data: unassignedChallengesData } = useGetV1Challenges(
    { scope: "public", page: 1, perPage: 50 },
    { query: { enabled: !!id && canAssignChallenges } }
  );
  const classroomChallenges = classroomChallengesData?.data ?? [];
  const unassignedChallenges = unassignedChallengesData?.data ?? [];

  const { data: orgMembersData } = useGetV1OrganizationsIdMembers(
    orgId ?? "",
    undefined,
    { query: { enabled: !!(orgId && canManageEnrollments) } }
  );
  const orgMembers = orgMembersData?.data ?? [];
  const enrolledIds = new Set((classroom?.enrollments ?? []).map((e) => e.userId));
  const availableToEnroll = orgMembers.filter((m) => !enrolledIds.has(m.userId));
  const teachersInOrg = orgMembers.filter((m) =>
    ["teacher", "coordinator", "admin"].includes(m.role)
  );

  const putMutation = usePutV1ClassroomsId({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1ClassroomsIdQueryKey(id) });
        setEditingTitle(false);
        setEditingDesc(false);
      },
    },
  });

  const enrollMutation = usePostV1ClassroomsIdEnroll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1ClassroomsIdQueryKey(id) });
        setEnrollSelectValue("");
      },
    },
  });

  const unenrollMutation = usePostV1ClassroomsIdUnenroll({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1ClassroomsIdQueryKey(id) });
      },
    },
  });

  const handleSaveTitle = () => {
    if (titleDraft.trim()) {
      putMutation.mutate({ id, data: { title: titleDraft.trim() } });
    } else {
      setEditingTitle(false);
    }
  };

  const handleSaveDesc = () => {
    putMutation.mutate({ id, data: { description: descDraft || null } });
  };

  const handleEnroll = (userId: string) => {
    enrollMutation.mutate({ id, data: { userId } });
  };

  const handleUnenroll = (userId: string) => {
    unenrollMutation.mutate({ id, data: { userId } });
  };

  const handleTeacherChange = (value: string) => {
    const teacherUserId = value === TEACHER_NONE_VALUE ? null : value;
    putMutation.mutate({ id, data: { teacherUserId } });
  };

  const assignChallengeMutation = usePatchV1ChallengesId({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
      },
    },
  });
  const handleAssignChallenge = (challengeId: string) => {
    assignChallengeMutation.mutate({ id: challengeId, data: { classroomId: id } });
  };
  const handleUnassignChallenge = (challengeId: string) => {
    assignChallengeMutation.mutate({ id: challengeId, data: { classroomId: null } });
  };

  if (classroomLoading || !classroom) {
    return (
      <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (classroomError) {
    return (
      <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-xl mx-auto rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {classroomError instanceof Error
              ? classroomError.message
              : "Erro ao carregar turma"}
          </div>
          <Button
            variant="outline"
            className="mt-6 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors duration-200"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const inputClass =
    "bg-slate-900 border-slate-700 text-slate-200";
  const selectTriggerClass =
    "bg-slate-900 border-slate-700 text-slate-200";
  const selectContentClass = "bg-slate-800 border-slate-700";
  const selectItemClass = "text-slate-200 focus:bg-slate-700";

  return (
    <div className="min-h-screen bg-slate-900 bg-[url('/grid.svg')] bg-fixed bg-center">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/explore"
          className="inline-flex items-center text-slate-400 hover:text-slate-200 mb-8 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Explorar
        </Link>

        <div className="mb-10 text-center max-w-4xl mx-auto">
          {editingTitle ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 max-w-2xl mx-auto">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className={inputClass}
                placeholder="Título da turma"
              />
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  onClick={handleSaveTitle}
                  disabled={putMutation.isPending}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium"
                >
                  {putMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  onClick={() => {
                    setEditingTitle(false);
                    setTitleDraft(classroom.title);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent text-center break-words">
                {classroom.title}
              </h1>
              {canEditMetadata && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTitle(true);
                    setTitleDraft(classroom.title);
                  }}
                  className="text-slate-400 hover:text-yellow-400 transition-colors shrink-0"
                  aria-label="Editar título"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          <p className="text-slate-400 text-lg mt-3">
            {classroom.organizationName ?? "—"} ·{" "}
            {classroom.teacherName
              ? `Prof. ${classroom.teacherName}`
              : "Sem professor definido"}
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Gerencie informações, alunos e problemas desta turma
          </p>
        </div>

        <div className="space-y-0 max-w-5xl mx-auto">
          <SectionDivider label="Sobre a turma" />

          <Card className="p-6 bg-slate-800 border-slate-700">
            <CardContent className="p-0 space-y-4">
              {editingDesc ? (
                <div className="space-y-2">
                  <Label className="text-slate-200">Descrição</Label>
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    className={`min-h-[100px] ${inputClass}`}
                    placeholder="Descrição da turma"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDesc}
                      disabled={putMutation.isPending}
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-medium"
                    >
                      {putMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                      onClick={() => {
                        setEditingDesc(false);
                        setDescDraft(classroom.description ?? "");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="text-slate-300 flex-1 leading-relaxed">
                    {classroom.description || "Sem descrição."}
                  </p>
                  {canEditMetadata && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDesc(true);
                        setDescDraft(classroom.description ?? "");
                      }}
                      className="text-slate-400 hover:text-yellow-400 transition-colors shrink-0"
                      aria-label="Editar descrição"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {canSetTeacher && orgId === user?.activeOrganizationId && (
                <div className="pt-4 border-t border-slate-700">
                  <Label className="text-slate-200 block mb-2">
                    Professor responsável
                  </Label>
                  <Select
                    value={classroom.teacherUserId ?? TEACHER_NONE_VALUE}
                    onValueChange={handleTeacherChange}
                    disabled={putMutation.isPending}
                  >
                    <SelectTrigger
                      className={`w-full max-w-md ${selectTriggerClass}`}
                    >
                      <SelectValue placeholder="Selecione o professor" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem
                        value={TEACHER_NONE_VALUE}
                        className={selectItemClass}
                      >
                        Nenhum
                      </SelectItem>
                      {teachersInOrg.map((m) => (
                        <SelectItem
                          key={m.id}
                          value={m.userId}
                          className={selectItemClass}
                        >
                          {m.name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <SectionDivider label="Alunos matriculados" />

          <Card className="p-6 bg-slate-800 border-slate-700">
            <CardContent className="p-0 space-y-4">
              {canManageEnrollments && availableToEnroll.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={enrollSelectValue}
                    onValueChange={(userId: string) => {
                      if (userId) {
                        handleEnroll(userId);
                        setEnrollSelectValue(userId);
                      }
                    }}
                    disabled={enrollMutation.isPending}
                  >
                    <SelectTrigger
                      className={`w-full sm:w-[min(100%,320px)] ${selectTriggerClass}`}
                    >
                      <SelectValue placeholder="Adicionar membro da organização…" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {availableToEnroll.map((m) => (
                        <SelectItem
                          key={m.id}
                          value={m.userId}
                          className={selectItemClass}
                        >
                          <span className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 shrink-0" />
                            {m.name} ({m.email})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!classroom.enrollments?.length ? (
                <p className="text-slate-400 py-2">Nenhum aluno matriculado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-200">Nome</TableHead>
                      <TableHead className="text-slate-200">Email</TableHead>
                      {canManageEnrollments && (
                        <TableHead className="text-slate-200 w-24">Ações</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classroom.enrollments.map((e) => (
                      <TableRow
                        key={e.userId}
                        className="border-slate-700 hover:bg-slate-900/40"
                      >
                        <TableCell className="text-slate-100">{e.name}</TableCell>
                        <TableCell className="text-slate-300">{e.email}</TableCell>
                        {canManageEnrollments && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => handleUnenroll(e.userId)}
                              disabled={
                                unenrollMutation.isPending ||
                                e.userId === user?.id
                              }
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <SectionDivider label="Problemas da turma" />

          <Card className="p-6 bg-slate-800 border-slate-700">
            <CardContent className="p-0 space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                <div className="flex items-center justify-center rounded-lg bg-slate-900/80 ring-1 ring-slate-700/80 p-2">
                  <BookOpen className="h-5 w-5 text-orange-400" />
                </div>
                Lista de problemas
              </div>
              {canAssignChallenges && unassignedChallenges.length > 0 && (
                <p className="text-sm text-slate-400">
                  Atribua problemas sem turma a esta turma:
                </p>
              )}
              {classroomChallenges.length > 0 ? (
                <div className="space-y-2">
                  {classroomChallenges.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 px-4 rounded-lg bg-slate-900/60 border border-slate-700"
                    >
                      <Link
                        href={`/problem/${ch.id}`}
                        className="text-slate-100 hover:text-yellow-400 font-medium transition-colors"
                      >
                        {ch.title}
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {ch.difficulty && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              ch.difficulty === "easy"
                                ? "bg-green-500/20 text-green-400"
                                : ch.difficulty === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {ch.difficulty}
                          </span>
                        )}
                        {canAssignChallenges && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                            onClick={() => handleUnassignChallenge(ch.id)}
                            disabled={assignChallengeMutation.isPending}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 py-2">
                  Nenhum problema atribuído a esta turma.
                </p>
              )}
              {canAssignChallenges && unassignedChallenges.length > 0 && (
                <div className="pt-4 border-t border-slate-700">
                  <Label className="text-slate-200 block mb-2">
                    Atribuir problema à turma
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {unassignedChallenges.map((ch) => (
                      <Button
                        key={ch.id}
                        size="sm"
                        variant="outline"
                        className="gap-1 bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors duration-200"
                        onClick={() => handleAssignChallenge(ch.id)}
                        disabled={assignChallengeMutation.isPending}
                      >
                        <Plus className="h-3 w-3" />
                        {ch.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
