import { FastifyTypedInstance } from "../../../types";
import { startWorkSessionRoute } from "./start";

export async function workSessionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify) => {
      await startWorkSessionRoute(fastify);
    },
    { prefix: "/work-sessions" }
  );
}
