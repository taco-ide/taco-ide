import { FastifyTypedInstance } from "../../../types";
import { listSubmissionsRoute } from "./list";
import { getSubmissionByIdRoute } from "./getById";
import { gradeSubmissionRoute } from "./grade";

export async function submissionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listSubmissionsRoute(fastify);
      await getSubmissionByIdRoute(fastify);
      await gradeSubmissionRoute(fastify);
    },
    { prefix: "/challenges/:challengeId/submissions" }
  );
}
