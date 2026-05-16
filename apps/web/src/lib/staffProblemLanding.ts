import type { User } from "@/contexts/UserContext";

/** Campos do GET challenge usados só para decidir landing staff vs IDE aluno */
export type ChallengeStaffLandingMeta = {
  createdByUserId: string | null;
  classroomTeacherUserId: string | null;
};

/**
 * Docente autor do desafio ou professor titular da turma; coordenador/admin tratam como staff.
 * Alunos e outros professores abrem direto a experiência tipo aluno.
 */
export function shouldOpenStaffWorkSessionsFirst(
  user: User | null,
  challenge: ChallengeStaffLandingMeta | undefined
): boolean {
  if (!user?.role || !challenge) return false;
  if (user.role === "student") return false;
  if (user.role === "coordinator" || user.role === "admin") return true;
  if (user.role === "teacher") {
    if (challenge.createdByUserId === user.id) return true;
    if (
      challenge.classroomTeacherUserId &&
      challenge.classroomTeacherUserId === user.id
    ) {
      return true;
    }
    return false;
  }
  return false;
}
