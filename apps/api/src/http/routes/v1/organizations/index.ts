import { FastifyTypedInstance } from "../../../types";
import { listOrganizationsRoute } from "./list";
import { listMyOrganizationsRoute } from "./mine";
import { createOrganizationRoute } from "./create";
import { getOrganizationByIdRoute } from "./getById";
import { updateOrganizationRoute } from "./update";
import { setOrganizationActiveRoute } from "./setActive";
import { addExistingMemberRoute } from "./members/addExisting";
import { listMembersRoute } from "./members/list";
import { moveMemberRoute } from "./members/move";
import { removeMemberRoute } from "./members/remove";
import { updateMemberRoleRoute } from "./members/updateRole";
import { importCsvMembersRoute } from "./members/importCsv";
import { createInvitationRoute } from "./invitations/create";
import { deleteInvitationRoute } from "./invitations/delete";
import { listInvitationsRoute } from "./invitations/list";
import { resendInvitationRoute } from "./invitations/resend";
import { emailDomainsRoutes } from "./email-domains";

export async function organizationsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      // Authenticated user route: list active orgs they belong to. Must be
      // registered before listOrganizationsRoute because both share the
      // "/organizations" prefix and Fastify resolves the more specific path
      // first regardless of order, but keeping it grouped near the top makes
      // intent explicit.
      await listMyOrganizationsRoute(fastify);

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
          // Phase 4 — Issue #64: bulk CSV member import.
          await importCsvMembersRoute(sf);
          await createInvitationRoute(sf);
          await deleteInvitationRoute(sf);
          await listInvitationsRoute(sf);
          await resendInvitationRoute(sf);
          await emailDomainsRoutes(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/organizations" }
  );
}
