import { FastifyTypedInstance } from "../../../../types";
import { createEntryRoute } from "./create";
import { updateEntryRoute } from "./update";
import { deleteEntryRoute } from "./delete";

export async function entryRoutes(app: FastifyTypedInstance) {
  await createEntryRoute(app);
  await updateEntryRoute(app);
  await deleteEntryRoute(app);
}
