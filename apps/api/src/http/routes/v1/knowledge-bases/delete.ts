import { assertKnowledgeBaseResourceAccess } from "../../../services/knowledge-base-access";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { knowledgeBase } from "@repo/infra/db/schema";

// ==================== SCHEMAS ====================

const DeleteKnowledgeBaseParamsSchema = z.object({
  kbId: z.string().min(1),
});

// ==================== ROUTE ====================

export async function deleteKnowledgeBaseRoute(app: FastifyTypedInstance) {
  app.delete<{
    Params: z.infer<typeof DeleteKnowledgeBaseParamsSchema>;
  }>(
    "/:kbId",
    {
      preHandler: [requirePermission("knowledgeBase", "delete")],
      schema: {
        tags: ["knowledge-bases"],
        summary: "Delete knowledge base",
        description: "Soft delete a knowledge base",
        params: DeleteKnowledgeBaseParamsSchema,
        response: {
          204: ResponseSchema204,
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

      const { kbId } = request.params;

      const access = await assertKnowledgeBaseResourceAccess(
        usr,
        kbId,
        "manage"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      await db
        .update(knowledgeBase)
        .set({ deletedAt: new Date() })
        .where(eq(knowledgeBase.id, kbId));

      return reply.status(204).send({
        success: true as const,
      });
    }
  );
}
