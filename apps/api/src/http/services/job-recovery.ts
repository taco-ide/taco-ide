import { eq } from "drizzle-orm";
import { db } from "@repo/infra/db";
import { submission, challengeReferenceSolution } from "@repo/infra/db/schema";

export const RESTART_RECOVERY_MESSAGE =
  "Interrompido por reinício do servidor. Gere novamente.";

/**
 * Auto-review and reference-solution generation run in-process (fire-and-forget
 * on submit/create, awaited on manual re-run/regenerate). A process restart
 * leaves any in-flight job stuck in `running` forever, which then makes the
 * regenerate / re-run endpoints return 409 indefinitely (issue #95).
 *
 * On startup any `running` row is necessarily orphaned — no in-process
 * generation can survive a restart — so we flip it to `failed` with an
 * explanatory message. This complements the atomic claim in the generators
 * (issue #96): the claim is the in-process guard, this is the cross-restart
 * guard. Returns the number of rows reset so callers can log it.
 */
export async function recoverStaleRunningJobs(): Promise<{
  submissions: number;
  referenceSolutions: number;
}> {
  const resetSubmissions = await db
    .update(submission)
    .set({
      autoReviewStatus: "failed",
      autoReviewError: RESTART_RECOVERY_MESSAGE,
    })
    .where(eq(submission.autoReviewStatus, "running"))
    .returning({ id: submission.id });

  const resetReferenceSolutions = await db
    .update(challengeReferenceSolution)
    .set({
      status: "failed",
      error: RESTART_RECOVERY_MESSAGE,
      updatedAt: new Date(),
    })
    .where(eq(challengeReferenceSolution.status, "running"))
    .returning({ id: challengeReferenceSolution.id });

  return {
    submissions: resetSubmissions.length,
    referenceSolutions: resetReferenceSolutions.length,
  };
}
