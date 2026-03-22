import { FastifyTypedInstance } from "../../../types";
import { listClassroomsRoute } from "./list";
import { createClassroomRoute } from "./create";
import { getClassroomByIdRoute } from "./getById";
import { updateClassroomRoute } from "./update";
import { deleteClassroomRoute } from "./delete";
import { enrollClassroomRoute } from "./enroll";
import { unenrollClassroomRoute } from "./unenroll";

export async function classroomsRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await listClassroomsRoute(fastify);
      await createClassroomRoute(fastify);
      await fastify.register(
        async (sf: FastifyTypedInstance) => {
          await getClassroomByIdRoute(sf);
          await updateClassroomRoute(sf);
          await deleteClassroomRoute(sf);
          await enrollClassroomRoute(sf);
          await unenrollClassroomRoute(sf);
        },
        { prefix: "/:id" }
      );
    },
    { prefix: "/classrooms" }
  );
}
