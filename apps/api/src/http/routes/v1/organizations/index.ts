import { FastifyTypedInstance } from "../../../types";
import { listMembersRoute } from "./members/list";
import { updateMemberRoleRoute } from "./members/updateRole";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";
import { emailDomainsRoutes } from "./email-domains";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await listMembersRoute(sf);
          await updateMemberRoleRoute(sf);
          await createInvitationRoute(sf);
          await deleteInvitationRoute(sf);
          await emailDomainsRoutes(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/organizations" }
  );
}

