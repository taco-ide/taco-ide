import { FastifyTypedInstance } from "../../../types";
import { listChallengesRoute } from "./list";
import { getChallengeByIdRoute } from "./getById";
import { createChallengeRoute } from "./create";
import { updateChallengeRoute } from "./update";
import { deleteChallengeRoute } from "./delete";
import { solutionsRoutes } from "../solutions";
import { challengeKnowledgeBasesRoutes } from "./knowledge-bases";

export async function challengesRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listChallengesRoute(fastify);
      await getChallengeByIdRoute(fastify);
      await createChallengeRoute(fastify);
      await updateChallengeRoute(fastify);
      await deleteChallengeRoute(fastify);
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await solutionsRoutes(sf);
        },
        { prefix: "/:id" }
      );
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await challengeKnowledgeBasesRoutes(sf);
        },
        { prefix: "/:challengeId/knowledge-bases" }
      );
    },
    { prefix: "/challenges" }
  );
}
