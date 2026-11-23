import { FastifyTypedInstance } from "../../../types";
import { getInvitationPreviewRoute } from "./getById";

export async function invitationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await getInvitationPreviewRoute(fastify);
    },
    { prefix: "/invitations" }
  );
}
