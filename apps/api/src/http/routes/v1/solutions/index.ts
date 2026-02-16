import { FastifyTypedInstance } from "../../../types";
import { getSolutionRoute } from "./get";
import { upsertSolutionRoute } from "./upsert";

export async function solutionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await getSolutionRoute(fastify);
      await upsertSolutionRoute(fastify);
    },
    { prefix: "/solution" }
  );
}
