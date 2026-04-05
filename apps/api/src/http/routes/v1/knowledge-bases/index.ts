import { FastifyTypedInstance } from "../../../types";
import { createKnowledgeBaseRoute } from "./create";
import { listKnowledgeBasesRoute } from "./list";
import { getKnowledgeBaseByIdRoute } from "./get-by-id";
import { updateKnowledgeBaseRoute } from "./update";
import { deleteKnowledgeBaseRoute } from "./delete";
import { searchKnowledgeBaseRoute } from "./search";
import { documentRoutes } from "./documents";
import { entryRoutes } from "./entries";

export async function knowledgeBasesRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listKnowledgeBasesRoute(fastify);
      await createKnowledgeBaseRoute(fastify);

      // Search is registered at /:kbId/search (no conflict with /:kbId)
      await searchKnowledgeBaseRoute(fastify);
      await getKnowledgeBaseByIdRoute(fastify);
      await updateKnowledgeBaseRoute(fastify);
      await deleteKnowledgeBaseRoute(fastify);

      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await documentRoutes(sf);
        },
        { prefix: "/:kbId/documents" }
      );

      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await entryRoutes(sf);
        },
        { prefix: "/:kbId/entries" }
      );
    },
    { prefix: "/knowledge-bases" }
  );
}
