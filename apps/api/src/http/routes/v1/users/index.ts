import { FastifyTypedInstance } from "../../../types";
import { accessStatusRoute } from "./accessStatus";
import { meRoute } from "./me";
import { searchUsersRoute } from "./search";
import { setPlatformAdminRoute } from "./setPlatformAdmin";
import { updateUserRoute } from "./update";

export async function usersRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await meRoute(fastify);
      await accessStatusRoute(fastify);
      await searchUsersRoute(fastify);
      await setPlatformAdminRoute(fastify);
      await updateUserRoute(fastify);
    },
    { prefix: "/users" }
  );
}
