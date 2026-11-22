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
import { challenge, challengeTeachingAssistant } from "@repo/infra/db/schema";
import { findAssignableTeachingAssistant } from "../../../services/teaching-assistant-access";
import {
  assertCanListChallengeWorkSessions,
  loadChallengeWorkAccessContext,
  loadClassroomAccessContext,
  assertCanAccessClassroom,
} from "../../../services/work-session-access";
import { generateReferenceSolutions } from "../../../../agents/teachers-companion/reference-solution";

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
    generateReferenceSolutions: z.boolean().optional(),
    /**
     * Replaces the challenge's teaching assistant. `null` removes the link so
     * new work sessions use the organization's default assistant.
     */
    teachingAssistantId: z.string().min(1).nullable().optional(),
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
    teachingAssistantId: z.string().nullable().optional(),
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
          "Update challenge content, teaching assistant or classroom assignment. The teaching assistant must be active and belong to the challenge's organization. Teachers can manage challenges they created or whose classroom they lead. Coordinators/admins can manage challenges in the target organization; platform admins can manage globally. All changes require source management access. Assignment also requires destination classroom management access and removal of an existing assignment first.",
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

      const wantsTeachingAssistantChange = body.teachingAssistantId !== undefined;
      if (wantsTeachingAssistantChange && body.teachingAssistantId) {
        // The organization the challenge will belong to after this update.
        const targetOrganizationId =
          wantsClassroomChange && classroomId
            ? (await loadClassroomAccessContext(classroomId))?.organizationId
            : wantsClassroomChange
              ? null
              : ctx.organizationId;
        if (!targetOrganizationId)
          return reply.status(400).send({
            success: false as const,
            message:
              "Assign the challenge to a classroom before choosing a teaching assistant",
          });
        const ta = await findAssignableTeachingAssistant(
          body.teachingAssistantId,
          targetOrganizationId
        );
        if (!ta)
          return reply.status(400).send({
            success: false as const,
            message:
              "Teaching assistant not found, inactive or from another organization",
          });
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

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
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
          });
        if (row && wantsTeachingAssistantChange) {
          await tx
            .delete(challengeTeachingAssistant)
            .where(eq(challengeTeachingAssistant.challengeId, challengeId));
          if (body.teachingAssistantId)
            await tx.insert(challengeTeachingAssistant).values({
              challengeId,
              teachingAssistantId: body.teachingAssistantId,
              isDefault: true,
            });
        }
        return row;
      });

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
          ...(wantsTeachingAssistantChange
            ? { teachingAssistantId: body.teachingAssistantId ?? null }
            : {}),
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
