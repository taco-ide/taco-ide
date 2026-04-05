import { FastifyTypedInstance } from "../../../../types";
import { linkKnowledgeBaseRoute } from "./link";
import { listChallengeKnowledgeBasesRoute } from "./list";
import { unlinkKnowledgeBaseRoute } from "./unlink";
import { searchChallengeKnowledgeBasesRoute } from "./search";

export async function challengeKnowledgeBasesRoutes(
  app: FastifyTypedInstance
) {
  // Register search BEFORE parameterized routes to avoid /:kbId conflict
  await searchChallengeKnowledgeBasesRoute(app);
  await linkKnowledgeBaseRoute(app);
  await listChallengeKnowledgeBasesRoute(app);
  await unlinkKnowledgeBaseRoute(app);
}
