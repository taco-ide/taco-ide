import { FastifyTypedInstance } from "../../../types";
import { listMembersRoute } from "./members/list";
import { updateMemberRoleRoute } from "./members/updateRole";
import { importCsvMembersRoute } from "./members/importCsv";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await listMembersRoute(sf);
          await updateMemberRoleRoute(sf);
          // Phase 4 — Issue #64: bulk CSV member import.
          await importCsvMembersRoute(sf);
          await createInvitationRoute(sf);
          await deleteInvitationRoute(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/organizations" }
  );
}

