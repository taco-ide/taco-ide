import { FastifyTypedInstance } from "../../../types";
import { meRoute } from "./me";

export async function usersRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await meRoute(fastify);
    },
    { prefix: "/users" }
  );
}
