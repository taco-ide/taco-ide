import { FastifyTypedInstance } from "../../../../types";
import { listEmailDomainsRoute } from "./list";
import { createEmailDomainRoute } from "./create";
import { deleteEmailDomainRoute } from "./delete";

export async function emailDomainsRoutes(app: FastifyTypedInstance) {
  await listEmailDomainsRoute(app);
  await createEmailDomainRoute(app);
  await deleteEmailDomainRoute(app);
}
