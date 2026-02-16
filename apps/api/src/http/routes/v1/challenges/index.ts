import { FastifyTypedInstance } from "../../../types";
import { listChallengesRoute } from "./list";
import { getChallengeByIdRoute } from "./getById";
import { solutionsRoutes } from "../solutions";

export async function challengesRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listChallengesRoute(fastify);
      await getChallengeByIdRoute(fastify);
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await solutionsRoutes(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/challenges" }
  );
}
