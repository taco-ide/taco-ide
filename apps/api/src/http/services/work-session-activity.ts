/**
 * Derived activity status for work sessions.
 *
 * `workSession.endedAt` means "submitted" (submit sets it, reopen clears it,
 * and new interactions are refused while it is set), so inactivity must never
 * write it. Instead the status is computed on read:
 *
 * - `submitted`: `endedAt` is set
 * - `active`:    open, last student activity within the threshold
 * - `inactive`:  open, no student activity for the threshold or longer
 *
 * Last activity is the latest of: session creation, `lastMessageAt` (bumped by
 * chat messages and code runs), `workSession.updatedAt` and the student's
 * saved solution for the challenge (`challengeSolution.updatedAt`, saved on
 * runs and chats).
 *
 * `workSession.updatedAt` is written only on create, on interactions (same
 * instant as `lastMessageAt`), on submit and on staff reopen. Submit doesn't
 * matter (the session is then `submitted`), so in practice it adds exactly
 * one signal: a reopen restarts the inactivity clock, instead of a session
 * reopened days later showing "inactive" straight away.
 */
import { and, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { env } from "@repo/infra/env";
import { challengeSolution, workSession } from "@repo/infra/db/schema";

export const workSessionActivityStatuses = [
  "active",
  "inactive",
  "submitted",
] as const;

export type WorkSessionActivityStatus =
  (typeof workSessionActivityStatuses)[number];

export function inactivityThresholdHours(): number {
  return env.WORK_SESSION_INACTIVITY_HOURS;
}

export function inactivityThresholdMs(): number {
  return inactivityThresholdHours() * 60 * 60 * 1000;
}

/** Sessions whose last activity is at or before this instant are inactive. */
export function inactivityCutoff(
  now: Date = new Date(),
  thresholdMs: number = inactivityThresholdMs()
): Date {
  return new Date(now.getTime() - thresholdMs);
}

export function deriveWorkSessionStatus(
  session: { endedAt: Date | null; lastActivityAt: Date },
  now: Date = new Date(),
  thresholdMs: number = inactivityThresholdMs()
): WorkSessionActivityStatus {
  if (session.endedAt) return "submitted";
  return session.lastActivityAt.getTime() > inactivityCutoff(now, thresholdMs).getTime()
    ? "active"
    : "inactive";
}

/**
 * Join condition for the student's saved solution. Use with
 * `.leftJoin(challengeSolution, workSessionSolutionJoin)` wherever
 * `lastActivityAtSql` is selected or filtered on (one row per user and
 * challenge, backed by a unique index).
 */
export const workSessionSolutionJoin = and(
  eq(challengeSolution.userId, workSession.userId),
  eq(challengeSolution.challengeId, workSession.challengeId)
);

/** GREATEST ignores NULLs, so the result is never older than `createdAt`. */
export const lastActivityAtSql = sql<Date>`GREATEST(${workSession.createdAt}, ${workSession.updatedAt}, ${workSession.lastMessageAt}, ${challengeSolution.updatedAt})`.mapWith(
  workSession.createdAt
);

/** WHERE clause matching sessions in the given status (requires the solution join). */
export function workSessionStatusFilter(
  status: WorkSessionActivityStatus,
  cutoff: Date
): SQL {
  if (status === "submitted") return isNotNull(workSession.endedAt);
  const cutoffParam = sql.param(cutoff, workSession.createdAt);
  return status === "active"
    ? and(isNull(workSession.endedAt), sql`${lastActivityAtSql} > ${cutoffParam}`)!
    : and(isNull(workSession.endedAt), sql`${lastActivityAtSql} <= ${cutoffParam}`)!;
}
