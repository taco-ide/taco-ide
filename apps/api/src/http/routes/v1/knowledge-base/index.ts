import { FastifyTypedInstance } from "../../../types";
import { listKnowledgeBaseRoute } from "./list";
import { createKnowledgeBaseRoute } from "./create";
import { updateKnowledgeBaseRoute } from "./update";
import { deleteKnowledgeBaseRoute } from "./delete";
import { searchKnowledgeBaseRoute } from "./search";
import { documentRoutes } from "./documents";

export async function knowledgeBaseRoutes(app: FastifyTypedInstance) {
  // Register search BEFORE parameterized routes to avoid /:kbId conflict
  await searchKnowledgeBaseRoute(app);
  await listKnowledgeBaseRoute(app);
  await createKnowledgeBaseRoute(app);
  await updateKnowledgeBaseRoute(app);
  await deleteKnowledgeBaseRoute(app);
  await app.register(documentRoutes, { prefix: "/documents" });
}
