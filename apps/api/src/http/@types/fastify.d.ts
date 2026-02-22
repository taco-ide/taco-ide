import "fastify";
import type { RoleName } from "@repo/infra/auth";

// User type from authenticated session
interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  activeOrganizationId: string | null;
  role: RoleName | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
