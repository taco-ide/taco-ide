import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase, classroom } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const CreateKnowledgeBaseBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    classroomId: z.string().min(1),
  })
  .strict();

const KnowledgeBaseCreatedSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  classroomId: z.string(),
  organizationId: z.string(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
});

const CreateKnowledgeBaseResponseSchema = ResponseSchema201.extend({
  data: KnowledgeBaseCreatedSchema,
});

// ==================== ROUTE ====================

export async function createKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateKnowledgeBaseBodySchema>;
  }>(
    "/",
    {
      preHandler: [requirePermission("knowledgeBase", "create")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Create knowledge base",
        description: "Create a new knowledge base container",
        body: CreateKnowledgeBaseBodySchema,
        response: {
          201: CreateKnowledgeBaseResponseSchema,
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

      const organizationId = usr.activeOrganizationId;
      if (!organizationId) {
        return reply.status(400).send({
          success: false as const,
          message: "User must have an active organization",
        });
      }

      const { title, description, classroomId } = request.body;

      const cl = await db
        .select({
          id: classroom.id,
          organizationId: classroom.organizationId,
        })
        .from(classroom)
        .where(and(eq(classroom.id, classroomId), isNull(classroom.deletedAt)))
        .limit(1);

      if (!cl[0]) {
        return reply.status(404).send({
          success: false as const,
          message: "Classroom not found",
        });
      }

      if (cl[0].organizationId !== organizationId) {
        return reply.status(403).send({
          success: false as const,
          message: "Classroom does not belong to your active organization",
        });
      }

      const id = randomUUID();

      const [created] = await db
        .insert(knowledgeBase)
        .values({
          id,
          title,
          description: description ?? null,
          classroomId,
          organizationId,
          createdByUserId: usr.id,
        })
        .returning();

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create knowledge base",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          title: created.title,
          description: created.description,
          classroomId: created.classroomId,
          organizationId: created.organizationId,
          createdByUserId: created.createdByUserId,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
