import { FastifyTypedInstance } from "../../../types";
import { studentMessageRoute } from "./student-message";
import { teacherMessageRoute } from "./teacher-message";
import { studentHistoryRoute } from "./student-history";
import { teacherHistoryRoute } from "./teacher-history";

export async function chatRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify: FastifyTypedInstance) => {
      await studentMessageRoute(fastify);
      await teacherMessageRoute(fastify);
      await studentHistoryRoute(fastify);
      await teacherHistoryRoute(fastify);
    },
    { prefix: "/chat" },
  );
}
