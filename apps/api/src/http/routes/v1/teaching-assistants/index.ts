import { FastifyTypedInstance } from "../../../types";
import { listTeachingAssistantsRoute } from "./list";
import { getTeachingAssistantRoute } from "./getById";
import { createTeachingAssistantRoute } from "./create";
import { updateTeachingAssistantRoute } from "./update";
import { deleteTeachingAssistantRoute } from "./delete";

export async function teachingAssistantsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listTeachingAssistantsRoute(fastify);
      await getTeachingAssistantRoute(fastify);
      await createTeachingAssistantRoute(fastify);
      await updateTeachingAssistantRoute(fastify);
      await deleteTeachingAssistantRoute(fastify);
    },
    { prefix: "/teaching-assistants" }
  );
}
