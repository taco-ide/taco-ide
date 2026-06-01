import type { FastifyTypedInstance } from "../../../../types";
import { listRoute } from "./list";
import { updateRoute } from "./update";
import { regenerateRoute } from "./regenerate";
import { deleteRoute } from "./delete";

export async function referenceSolutionsRoutes(app: FastifyTypedInstance) {
  await listRoute(app);
  await updateRoute(app);
  await regenerateRoute(app);
  await deleteRoute(app);
}
