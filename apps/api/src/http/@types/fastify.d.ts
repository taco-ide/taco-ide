import "fastify";

// User type from authenticated session
interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
