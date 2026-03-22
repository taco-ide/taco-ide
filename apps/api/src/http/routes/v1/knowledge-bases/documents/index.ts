import { FastifyTypedInstance } from "../../../../types";
import { uploadDocumentRoute } from "./upload";
import { listDocumentsRoute } from "./list";
import { deleteDocumentRoute } from "./delete";

export async function documentRoutes(app: FastifyTypedInstance) {
  await uploadDocumentRoute(app);
  await listDocumentsRoute(app);
  await deleteDocumentRoute(app);
}
