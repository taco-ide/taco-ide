import { FastifyTypedInstance } from "../../../types";
import { addExistingMemberRoute } from "./members/addExisting";
import { listMembersRoute } from "./members/list";
import { updateMemberRoleRoute } from "./members/updateRole";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await addExistingMemberRoute(sf);
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

