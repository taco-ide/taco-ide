import { FastifyTypedInstance } from "../../../types";
import { createWorkSessionRoute } from "./create";
import { getWorkSessionByChallengeRoute } from "./getByChallenge";
import { getWorkSessionByIdRoute } from "./getById";
import { addInteractionRoute } from "./addInteraction";
import { chatRoute } from "./chat";
import { submitWorkSessionRoute } from "./submit";
import { reopenWorkSessionRoute } from "./reopen";
import { resetWorkSessionRoute } from "./reset";

export async function workSessionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await createWorkSessionRoute(fastify);
      await getWorkSessionByChallengeRoute(fastify);
      await addInteractionRoute(fastify);
      await chatRoute(fastify);
      await submitWorkSessionRoute(fastify);
      await reopenWorkSessionRoute(fastify);
      await resetWorkSessionRoute(fastify);
      await getWorkSessionByIdRoute(fastify);
    },
    { prefix: "/work-sessions" }
  );
}
