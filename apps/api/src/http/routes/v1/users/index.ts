import { FastifyTypedInstance } from "../../../types";
import { meRoute } from "./me";
import { searchUsersRoute } from "./search";
import { updateUserRoute } from "./update";

export async function usersRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await meRoute(fastify);
      await searchUsersRoute(fastify);
      await updateUserRoute(fastify);
    },
    { prefix: "/users" }
  );
}
