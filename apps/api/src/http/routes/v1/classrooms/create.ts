import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema201,
  ResponseSchema400,
  ResponseSchema401,
  ResponseSchema403,
} from "../../_responses/types";
import { db } from "@repo/infra/db";
import { classroom, organization, member } from "@repo/infra/db/schema";
import { roleHasPermission } from "@repo/infra/auth";

// ==================== SCHEMAS ====================

const CreateClassroomBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    organizationId: z.string().min(1),
    teacherUserId: z.string().min(1).nullable().optional(),
  })
  .strict();

const ClassroomSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  teacherUserId: z.string().nullable(),
  createdAt: z.string(),
});

const CreateClassroomResponseSchema = ResponseSchema201.extend({
  data: ClassroomSchema,
});

// ==================== ROUTE ====================

export async function createClassroomRoute(app: FastifyTypedInstance) {
  app.post<{
    Body: z.infer<typeof CreateClassroomBodySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["classrooms"],
        summary: "Create classroom",
        description: "Create a new classroom. Requires teacher+ role and membership in the organization.",
        body: CreateClassroomBodySchema,
        response: {
          201: CreateClassroomResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
          403: ResponseSchema403,
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

      const role = usr.role ?? "student";
      if (!roleHasPermission(role, "classroom", "create")) {
        return reply.status(403).send({
          success: false as const,
          message: "Insufficient permissions to create classrooms",
        });
      }

      const { title, description, organizationId, teacherUserId } = request.body;

      const orgExists = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      if (!orgExists[0]) {
        return reply.status(400).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      const membership = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, usr.id),
            eq(member.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!membership[0]) {
        return reply.status(403).send({
          success: false as const,
          message: "You must be a member of the organization to create classrooms",
        });
      }

      const teacherRoles = ["teacher", "coordinator", "admin"];
      if (!teacherRoles.includes(membership[0].role)) {
        return reply.status(403).send({
          success: false as const,
          message: "Only teachers and above can create classrooms in this organization",
        });
      }

      const isCoordinatorPlus = ["coordinator", "admin"].includes(membership[0].role);
      let resolvedTeacherId: string | null = null;
      if (teacherUserId !== undefined) {
        if (!isCoordinatorPlus) {
          return reply.status(403).send({
            success: false as const,
            message: "Only coordinator+ can assign a teacher when creating",
          });
        }
        resolvedTeacherId = teacherUserId;
      } else if (membership[0].role === "teacher") {
        resolvedTeacherId = usr.id;
      }

      const id = randomUUID();
      const [created] = await db
        .insert(classroom)
        .values({
          id,
          organizationId,
          title,
          description: description ?? null,
          teacherUserId: resolvedTeacherId,
        })
        .returning();

      if (!created) {
        return reply.status(500).send({
          success: false as const,
          message: "Failed to create classroom",
        });
      }

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created.id,
          title: created.title,
          description: created.description,
          organizationId: created.organizationId,
          teacherUserId: created.teacherUserId ?? null,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }
  );
}
