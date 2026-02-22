import { z } from "zod";
import { FastifyTypedInstance } from "../../../types";
import { ResponseSchema200, ResponseSchema401 } from "../../_responses/types";

// ==================== SCHEMAS ====================

const UserDataSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeOrganizationId: z.string().nullable(),
  role: z.string().nullable(),
});

const MeResponseSchema = ResponseSchema200.extend({
  data: UserDataSchema,
});

// ==================== ROUTE ====================

export async function meRoute(app: FastifyTypedInstance) {
  app.get(
    "/me",
    {
      schema: {
        tags: ["users"],
        summary: "Get current authenticated user data",
        description: "Returns the profile of the currently authenticated user",
        response: {
          200: MeResponseSchema,
          401: ResponseSchema401,
        },
      },
    },
    async (request, reply) => {
      const { user } = request;

      if (!user) {
        return reply.status(401).send({
          success: false as const,
          message: "Not authenticated",
        });
      }

      return reply.status(200).send({
        success: true as const,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          activeOrganizationId: user.activeOrganizationId,
          role: user.role,
        },
      });
    }
  );
}
