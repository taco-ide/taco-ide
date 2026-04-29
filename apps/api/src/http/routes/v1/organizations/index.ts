import { FastifyTypedInstance } from "../../../types";
import { listOrganizationsRoute } from "./list";
import { createOrganizationRoute } from "./create";
import { getOrganizationByIdRoute } from "./getById";
import { updateOrganizationRoute } from "./update";
import { setOrganizationActiveRoute } from "./setActive";
import { addExistingMemberRoute } from "./members/addExisting";
import { listMembersRoute } from "./members/list";
import { moveMemberRoute } from "./members/move";
import { removeMemberRoute } from "./members/remove";
import { updateMemberRoleRoute } from "./members/updateRole";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      // Top-level platform-admin routes (no :id prefix)
      await listOrganizationsRoute(fastify);
      await createOrganizationRoute(fastify);
      await getOrganizationByIdRoute(fastify);
      await updateOrganizationRoute(fastify);
      await setOrganizationActiveRoute(fastify);

      // Per-organization sub-routes (members, invitations) under /:id
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await addExistingMemberRoute(sf);
          await listMembersRoute(sf);
          await moveMemberRoute(sf);
          await removeMemberRoute(sf);
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
