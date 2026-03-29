import { z } from "zod";
import { eq, and, or, desc, isNull, sql, inArray } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema400, ResponseSchema401 } from "../../_responses/types";
import { db } from "@repo/infra/db";
import {
  classroom,
  organization,
  userClassroom,
} from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const ListClassroomsQuerySchema = z.object({
  scope: z.enum(["mine", "org", "all"]).default("all"),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
});

const ClassroomItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  organizationName: z.string().nullable(),
  createdAt: z.string(),
});

const ListClassroomsResponseSchema = ResponseSchema200.extend({
  data: z.array(ClassroomItemSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalPages: z.number(),
  }),
});

// ==================== ROUTE ====================

export async function listClassroomsRoute(app: FastifyTypedInstance) {
  app.get<{
    Querystring: z.infer<typeof ListClassroomsQuerySchema>;
  }>(
    "/",
    {
      schema: {
        tags: ["classrooms"],
        summary: "List classrooms",
        description:
          "List classrooms. scope=mine: user's enrolled or lead teacher; scope=org: from active org; scope=all: all non-deleted.",
        querystring: ListClassroomsQuerySchema,
        response: {
          200: ListClassroomsResponseSchema,
          400: ResponseSchema400,
          401: ResponseSchema401,
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

      const { scope, page, perPage } = request.query;
      const offset = (page - 1) * perPage;

      const conditions = [isNull(classroom.deletedAt)];

      if (scope === "mine") {
        const enrolledRows = await db
          .select({ id: userClassroom.classroomId })
          .from(userClassroom)
          .where(
            and(
              eq(userClassroom.userId, usr.id),
              isNull(userClassroom.deletedAt)
            )
          );
        const enrolledIds = enrolledRows.map((r) => r.id);
        const mineCondition =
          enrolledIds.length > 0
            ? or(inArray(classroom.id, enrolledIds), eq(classroom.teacherUserId, usr.id))
            : eq(classroom.teacherUserId, usr.id);
        conditions.push(mineCondition!);
      } else if (scope === "org") {
        if (!usr.activeOrganizationId) {
          return reply.status(400).send({
            success: false as const,
            message: "scope=org requires an active organization",
          });
        }
        conditions.push(eq(classroom.organizationId, usr.activeOrganizationId));
      }

      const whereClause = and(...conditions);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(classroom)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const classrooms = await db
        .select({
          id: classroom.id,
          title: classroom.title,
          description: classroom.description,
          organizationId: classroom.organizationId,
          createdAt: classroom.createdAt,
          organizationName: organization.name,
        })
        .from(classroom)
        .leftJoin(organization, eq(classroom.organizationId, organization.id))
        .where(whereClause)
        .orderBy(desc(classroom.createdAt))
        .limit(perPage)
        .offset(offset);

      const totalPages = Math.ceil(total / perPage);

      return reply.status(200).send({
        success: true as const,
        data: classrooms.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          organizationId: c.organizationId,
          organizationName: c.organizationName ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: { total, page, perPage, totalPages },
      });
    }
  );
}
