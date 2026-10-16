import { getMembershipRole } from "../../../services/work-session-access";
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
import { classroom, organization } from "@repo/infra/db/schema";
import { hasMinimumRole } from "@repo/infra/auth";

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
        description:
          "Create a new classroom. Requires teacher+ role and membership in the organization.",
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

      const { title, description, organizationId, teacherUserId } =
        request.body;

      const orgExists = await db
        .select({ id: organization.id })
        .from(organization)
        .where(
          and(
            eq(organization.id, organizationId),
            eq(organization.isActive, true)
          )
        )
        .limit(1);

      if (!orgExists[0]) {
        return reply.status(400).send({
          success: false as const,
          message: "Organization not found",
        });
      }

      const targetRole = await getMembershipRole(usr.id, organizationId);
      if (
        !usr.isPlatformAdmin &&
        (!targetRole || !hasMinimumRole(targetRole, "teacher"))
      )
        return reply.status(403).send({
          success: false as const,
          message:
            "Only teachers and above can create classrooms in this organization",
        });
      const isCoordinatorPlus =
        usr.isPlatformAdmin ||
        targetRole === "coordinator" ||
        targetRole === "admin";
      let resolvedTeacherId: string | null = null;
      if (teacherUserId !== undefined) {
        if (!isCoordinatorPlus) {
          return reply.status(403).send({
            success: false as const,
            message: "Only coordinator+ can assign a teacher when creating",
          });
        }
        resolvedTeacherId = teacherUserId;
      } else if (targetRole === "teacher") {
        resolvedTeacherId = usr.id;
      }

      if (resolvedTeacherId) {
        const teacherRole = await getMembershipRole(
          resolvedTeacherId,
          organizationId
        );
        if (!teacherRole || !hasMinimumRole(teacherRole, "teacher"))
          return reply.status(403).send({
            success: false as const,
            message: "Assigned teacher must be staff of this organization",
          });
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
