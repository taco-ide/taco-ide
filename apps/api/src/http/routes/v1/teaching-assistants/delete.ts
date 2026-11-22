import { z } from "zod";
import { eq } from "drizzle-orm";
import { FastifyTypedInstance } from "../../../types";
import {
  ResponseSchema204,
  ResponseSchema401,
  ResponseSchema403,
  ResponseSchema404,
  ResponseSchema409,
} from "../../_responses/types";
import { requirePermission } from "../../../middlewares/authorization";
import { db } from "@repo/infra/db";
import { teachingAssistant } from "@repo/infra/db/schema";
import {
  assertCanAccessTeachingAssistantOrg,
  listActiveLinkedChallenges,
  loadTeachingAssistant,
} from "../../../services/teaching-assistant-access";
import { TeachingAssistantParamsSchema } from "./shared";

export async function deleteTeachingAssistantRoute(app: FastifyTypedInstance) {
  app.delete<{ Params: z.infer<typeof TeachingAssistantParamsSchema> }>(
    "/:id",
    {
      preHandler: [requirePermission("teachingAssistant", "delete")],
      schema: {
        tags: ["teaching-assistants"],
        summary: "Delete teaching assistant",
        description:
          "Soft delete (and deactivate) a teaching assistant. Requires the teachingAssistant:delete permission in the assistant's organization, or platform admin. Returns 409 while the assistant is linked to non-deleted challenges; `errors.challenges` lists their titles.",
        params: TeachingAssistantParamsSchema,
        response: {
          204: ResponseSchema204,
          401: ResponseSchema401,
          403: ResponseSchema403,
          404: ResponseSchema404,
          409: ResponseSchema409,
        },
      },
    },
    async (request, reply) => {
      const usr = request.user;
      if (!usr)
        return reply
          .status(401)
          .send({ success: false as const, message: "Not authenticated" });

      const ta = await loadTeachingAssistant(request.params.id);
      if (!ta)
        return reply.status(404).send({
          success: false as const,
          message: "Teaching assistant not found",
        });

      const access = await assertCanAccessTeachingAssistantOrg(
        usr,
        ta.createdByOrganizationId,
        "delete"
      );
      if (!access.ok)
        return reply
          .status(access.status)
          .send({ success: false as const, message: access.message });

      const linked = await listActiveLinkedChallenges(ta.id);
      if (linked.length > 0)
        return reply.status(409).send({
          success: false as const,
          message: `Teaching assistant is used by ${linked.length} active challenge(s). Assign another teaching assistant to them before deleting it.`,
          errors: { challenges: linked.map((c) => c.title) },
        });

      const now = new Date();
      await db
        .update(teachingAssistant)
        .set({ deletedAt: now, updatedAt: now, isActive: false })
        .where(eq(teachingAssistant.id, ta.id));

      return reply.status(204).send({ success: true as const });
    }
  );
}
