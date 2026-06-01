import { FastifyTypedInstance } from "../../../types";
import { listSubmissionsRoute } from "./list";
import { getSubmissionByIdRoute } from "./getById";
import { gradeSubmissionRoute } from "./grade";
import { rerunAutoReviewRoute } from "./rerunAutoReview";

export async function submissionsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listSubmissionsRoute(fastify);
      await getSubmissionByIdRoute(fastify);
      await gradeSubmissionRoute(fastify);
      await rerunAutoReviewRoute(fastify);
    },
    { prefix: "/challenges/:challengeId/submissions" }
  );
}
