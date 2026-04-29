import { FastifyTypedInstance } from "../../../../types";
import { listEmailDomainsRoute } from "./list";
import { createEmailDomainRoute } from "./create";

export async function emailDomainsRoutes(app: FastifyTypedInstance) {
  await listEmailDomainsRoute(app);
  await createEmailDomainRoute(app);
}
