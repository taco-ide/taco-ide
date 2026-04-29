import { FastifyTypedInstance } from "../../../types";
import { listOrganizationsRoute } from "./list";
import { getOrganizationByIdRoute } from "./getById";
import { listMembersRoute } from "./members/list";
import { updateMemberRoleRoute } from "./members/updateRole";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      // Top-level platform-admin routes (no :id prefix)
      await listOrganizationsRoute(fastify);
      await getOrganizationByIdRoute(fastify);

      // Per-organization sub-routes (members, invitations) under /:id
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await listMembersRoute(sf);
          await updateMemberRoleRoute(sf);
          await createInvitationRoute(sf);
          await deleteInvitationRoute(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/organizations" }
  );
}
