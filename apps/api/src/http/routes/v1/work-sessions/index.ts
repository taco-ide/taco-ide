import { FastifyTypedInstance } from "../../../types";
import { createWorkSessionRoute } from "./create";
import { getWorkSessionByChallengeRoute } from "./getByChallenge";
import { getWorkSessionByIdRoute } from "./getById";
import { addInteractionRoute } from "./addInteraction";
import { chatRoute } from "./chat";

export async function workSessionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await createWorkSessionRoute(fastify);
      await getWorkSessionByChallengeRoute(fastify);
      await addInteractionRoute(fastify);
      await chatRoute(fastify);
      await getWorkSessionByIdRoute(fastify);
    },
    { prefix: "/work-sessions" }
  );
}
