import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema200,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  CHALLENGE_SCHEDULE_WINDOW_CHECK,
  challenge,
  challengeLatePolicyEnum,
} from "@repo/infra/db/schema";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
  loadClassroomAccessContext,
  assertCanAccessClassroom,
} from "../../../services/work-session-access";
import { generateReferenceSolutions } from "../../../../agents/teachers-companion/reference-solution";

const PG_CHECK_VIOLATION = "23514";

// The app-level window check below reads the row and writes it in separate
// statements, so a concurrent PATCH can still produce an inverted window. The
// DB CHECK constraint is the real guard; map its violation to a 400.
export function isScheduleWindowViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; ) {
    const { code, constraint_name, cause } = e as {
      code?: unknown;
      constraint_name?: unknown;
      cause?: unknown;
    };
    if (
      code === PG_CHECK_VIOLATION &&
      constraint_name === CHALLENGE_SCHEDULE_WINDOW_CHECK
    )
      return true;
    e = cause;
  }
  return false;
}

// ==================== SCHEMAS ====================

const ChallengeParamsSchema = z.object({
  id: z.string().min(1),
});

const UpdateChallengeBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    classroomId: z.string().min(1).nullable().optional(),
    releaseAt: z.string().datetime({ offset: true }).nullable().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    latePolicy: z.enum(challengeLatePolicyEnum).optional(),
    generateReferenceSolutions: z.boolean().optional(),
  })
  .strict();

const UpdateChallengeResponseSchema = ResponseSchema200.extend({
  data: z.object({
    id: z.string(),
    classroomId: z.string().nullable(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    difficulty: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    releaseAt: z.string().nullable(),
    dueAt: z.string().nullable(),
    latePolicy: z.enum(challengeLatePolicyEnum),
    message: z.string(),
  }),
});

// ==================== ROUTE ====================

export async function updateChallengeRoute(app: FastifyTypedInstance) {
  app.patch<{
    Params: z.infer<typeof ChallengeParamsSchema>;
    Body: z.infer<typeof UpdateChallengeBodySchema>;
  }>(
    "/:id",
    {
      schema: {
        tags: ["challenges"],
        summary: "Update challenge",
        description:
          "Update challenge content or classroom assignment. Teachers can manage challenges they created or whose classroom they lead. Coordinators/admins can manage challenges in the target organization; platform admins can manage globally. All changes require source management access. Assignment also requires destination classroom management access and removal of an existing assignment first.",
        params: ChallengeParamsSchema,
        body: UpdateChallengeBodySchema,
        response: {
          200: UpdateChallengeResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      const { id: challengeId } = request.params;
      const body = request.body;
      const wantsClassroomChange = Object.prototype.hasOwnProperty.call(
        body,
        "classroomId"
      );
      const { classroomId } = body;

      // Load the challenge scoped to its real organization (via classroom).
      // This is the authorization context: `usr.role` alone reflects the
      // caller's *active* org, not the challenge's, so relying on it would let
      // a coordinator/admin in org A edit a challenge in org B (IDOR).
      const ctx = await loadChallengeWorkAccessContext(challengeId);
      if (!ctx) {
        return reply.status(404).send({
          success: false as const,
          message: "Challenge not found",
        });
      }

      const access = await assertCanListChallengeWorkSessions(usr, ctx);
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      if (wantsClassroomChange && classroomId) {
        if (ctx.classroomId)
          return reply.status(400).send({
            success: false as const,
            message:
              "Challenge is already assigned to a classroom. Remove assignment first.",
          });
        const target = await loadClassroomAccessContext(classroomId);
        if (!target)
          return reply
            .status(404)
            .send({ success: false as const, message: "Classroom not found" });
        const targetAccess = await assertCanAccessClassroom(
          usr,
          target,
          "manage"
        );
        if (!targetAccess.ok)
          return reply
            .status(targetAccess.status)
            .send({ success: false as const, message: targetAccess.message });
      } else if (
        wantsClassroomChange &&
        classroomId === null &&
        !ctx.classroomId
      ) {
        return reply.status(400).send({
          success: false as const,
          message: "Challenge is not assigned to any classroom",
        });
      }

      // Validate the scheduling window against the *effective* values: a
      // PATCH may change only one bound, so the other comes from the row.
      if (body.releaseAt !== undefined || body.dueAt !== undefined) {
        const [current] = await db
          .select({ releaseAt: challenge.releaseAt, dueAt: challenge.dueAt })
          .from(challenge)
          .where(eq(challenge.id, challengeId))
          .limit(1);

        const effectiveReleaseAt =
          body.releaseAt !== undefined
            ? body.releaseAt && new Date(body.releaseAt)
            : current?.releaseAt;
        const effectiveDueAt =
          body.dueAt !== undefined
            ? body.dueAt && new Date(body.dueAt)
            : current?.dueAt;

        if (
          effectiveReleaseAt &&
          effectiveDueAt &&
          effectiveDueAt <= effectiveReleaseAt
        ) {
          return reply.status(400).send({
            success: false as const,
            message: "dueAt must be after releaseAt",
          });
        }
      }

      const setValues: Partial<typeof challenge.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (wantsClassroomChange) setValues.classroomId = classroomId;
      if (body.title !== undefined) setValues.title = body.title;
      if (body.description !== undefined)
        setValues.description = body.description;
      if (body.difficulty !== undefined) setValues.difficulty = body.difficulty;
      if (body.tags !== undefined) setValues.tags = body.tags;
      if (body.releaseAt !== undefined)
        setValues.releaseAt = body.releaseAt ? new Date(body.releaseAt) : null;
      if (body.dueAt !== undefined)
        setValues.dueAt = body.dueAt ? new Date(body.dueAt) : null;
      if (body.latePolicy !== undefined) setValues.latePolicy = body.latePolicy;

      let updated;
      try {
        [updated] = await db
          .update(challenge)
          .set(setValues)
          .where(eq(challenge.id, challengeId))
          .returning({
            id: challenge.id,
            classroomId: challenge.classroomId,
            title: challenge.title,
            description: challenge.description,
            difficulty: challenge.difficulty,
            tags: challenge.tags,
            releaseAt: challenge.releaseAt,
            dueAt: challenge.dueAt,
            latePolicy: challenge.latePolicy,
          });
      } catch (err) {
        if (!isScheduleWindowViolation(err)) throw err;
        return reply.status(400).send({
          success: false as const,
          message: "dueAt must be after releaseAt",
        });
      }

      if (!updated) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to update challenge",
        });
      }

      // Fire and forget reference solution generation if explicitly requested
      if (body.generateReferenceSolutions === true) {
        void generateReferenceSolutions(challengeId);
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: updated.id,
          classroomId: updated.classroomId ?? null,
          title: updated.title ?? null,
          description: updated.description ?? null,
          difficulty: updated.difficulty ?? null,
          tags: (updated.tags as string[] | null) ?? null,
          releaseAt: updated.releaseAt?.toISOString() ?? null,
          dueAt: updated.dueAt?.toISOString() ?? null,
          latePolicy: updated.latePolicy,
          message: wantsClassroomChange
            ? classroomId
              ? "Challenge assigned to classroom"
              : "Challenge unassigned from classroom"
            : "Challenge updated",
        },
      });
    }
  );
}
