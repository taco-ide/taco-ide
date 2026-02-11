import { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "@repo/infra/auth";
import { db } from "@repo/infra/db";
import { user } from "@repo/infra/db/schema";
import { eq } from "drizzle-orm";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Convert Fastify headers to Web API Headers
    const headersObj = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headersObj.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => headersObj.append(key, v));
      }
    }

    // Validate session with Better Auth
    const session = await auth.api.getSession({ headers: headersObj });

    if (!session?.user) {
      return reply.status(401).send({
        success: false,
        message: "Invalid or expired session",
      });
    }

    // Get additional user data
    const userData = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!userData[0] || !userData[0].isActive) {
      return reply.status(403).send({
        success: false,
        message: "User account is disabled",
      });
    }

    // Attach user to request
    request.user = {
      id: userData[0].id,
      email: userData[0].email,
      name: userData[0].name,
      emailVerified: userData[0].emailVerified,
      isActive: userData[0].isActive,
      createdAt: userData[0].createdAt,
      updatedAt: userData[0].updatedAt,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return reply.status(401).send({
      success: false,
      message: "Session token invalid or expired",
    });
  }
}
