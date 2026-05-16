import { FastifyTypedInstance } from "../../../../types";
import { listChallengeWorkSessionsRoute } from "./list";

export async function challengeWorkSessionsRoutes(app: FastifyTypedInstance) {
  await listChallengeWorkSessionsRoute(app);
}
