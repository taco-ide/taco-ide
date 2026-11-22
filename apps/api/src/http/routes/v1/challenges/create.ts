import {
  loadClassroomAccessContext,
  assertCanAccessClassroom,
} from "../../../services/work-session-access";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { challenge, challengeTeachingAssistant } from "@repo/infra/db/schema";
import {
  findAssignableTeachingAssistant,
  findDefaultTeachingAssistant,
} from "../../../services/teaching-assistant-access";
import { generateReferenceSolutions } from "../../../../agents/teachers-companion/reference-solution";

// ==================== SCHEMAS ====================

const CreateChallengeBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    classroomId: z.string().min(1),
    tags: z.array(z.string()).optional(),
    supportMaterials: z.unknown().optional(),
    generateReferenceSolutions: z.boolean().optional().default(true),
    /** Defaults to the organization's oldest active teaching assistant. */
    teachingAssistantId: z.string().min(1).optional(),
  })
  .strict();

const ChallengeCreatedSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  classroomId: z.string().nullable(),
  teachingAssistantId: z.string().nullable(),
  createdAt: z.string(),
});

const CreateChallengeResponseSchema = ResponseSchema201.extend({
  data: ChallengeCreatedSchema,
});

// ==================== ROUTE ====================

export async function createChallengeRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateChallengeBodySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["challenges"],
        summary: "Create challenge",
        description: "Create a new challenge",
        body: CreateChallengeBodySchema,
        response: {
          201: CreateChallengeResponseSchema,
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

      const {
        title,
        description,
        difficulty,
        classroomId,
        tags,
        supportMaterials,
        generateReferenceSolutions: shouldGenerateRefSolutions,
        teachingAssistantId,
      } = request.body;

      const cl = await loadClassroomAccessContext(classroomId);
      if (!cl)
        return reply
          .status(404)
          .send({ success: false as const, message: "Classroom not found" });
      const access = await assertCanAccessClassroom(usr, cl, "manage");
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });
      const organizationId = cl.organizationId;

      const chosenTA = teachingAssistantId
        ? await findAssignableTeachingAssistant(
            teachingAssistantId,
            organizationId
          )
        : await findDefaultTeachingAssistant(organizationId);
      if (teachingAssistantId && !chosenTA)
        return reply.status(400).send({
          success: false as const,
          message:
            "Teaching assistant not found, inactive or from another organization",
        });

      const id = randomUUID();

      const [created] = await db
        .insert(challenge)
        .values({
          id,
          title,
          description: description ?? null,
          difficulty,
          classroomId,
          tags: tags ?? null,
          supportMaterials: supportMaterials ?? null,
          createdByUserId: usr.id,
        })
        .returning();

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create challenge",
        });
      }

      if (chosenTA) {
        await db.insert(challengeTeachingAssistant).values({
          challengeId: created.id,
          teachingAssistantId: chosenTA.id,
          isDefault: true,
        });
      }

      // Fire and forget reference solution generation
      if (shouldGenerateRefSolutions !== false) {
        void generateReferenceSolutions(created.id);
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          title: created.title,
          description: created.description,
          difficulty: created.difficulty,
          tags: created.tags ?? null,
          classroomId: created.classroomId,
          teachingAssistantId: chosenTA?.id ?? null,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
