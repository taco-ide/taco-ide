import { fastify } from "fastify";
import fastifyCors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { SwaggerTheme, SwaggerThemeNameEnum } from "swagger-themes";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { env } from "@repo/infra/env";
import { registerRoutes } from "./routes/v1/index";
import { authMiddleware } from "./middlewares/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Fastify instance with Zod Type Provider
const app = fastify({ trustProxy: true }).withTypeProvider<ZodTypeProvider>();
const theme = new SwaggerTheme();
const darkCss = theme.getBuffer(SwaggerThemeNameEnum.DARK);

// IMPORTANT: Configure Zod compilers for validation and serialization
app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

// Map Zod request validation failures to the project's BaseErrorResponseSchema
// shape ({ success: false, message, errors }). Without this, Fastify's default
// 400 payload doesn't match ResponseSchema400 and the serializer turns the 400
// into 500 FST_ERR_FAILED_ERROR_SERIALIZATION.
app.setErrorHandler((error, request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.validation) {
      const path = issue.instancePath.replace(/^\//, "").replace(/\//g, ".") || "_";
      (errors[path] ??= []).push(issue.message);
    }
    return reply.status(400).send({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, "Response serialization failed");
    return reply.status(500).send({
      success: false,
      message: "Response serialization failed",
    });
  }

  const fastifyError = error as { statusCode?: number; message?: string };
  const statusCode =
    fastifyError.statusCode && fastifyError.statusCode >= 400 ? fastifyError.statusCode : 500;
  if (statusCode >= 500) {
    request.log.error({ err: error }, "Unhandled error");
  }
  return reply.status(statusCode).send({
    success: false,
    message: fastifyError.message || "Internal Server Error",
  });
});

// CORS configuration
const allowedOrigins = [env.FRONTEND_URL];

app.register(fastifyCors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Cookie",
  ],
  exposedHeaders: ["Set-Cookie"],
});

app.register(fastifyCookie);

app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

// Global authentication hook
app.addHook("onRequest", async (request, reply) => {
  const publicRoutes = ["/v1/auth/", "/api/auth/", "/v1/status", "/docs"];

  const isPublicRoute = publicRoutes.some((route) =>
    request.url.startsWith(route)
  );

  if (!isPublicRoute) {
    await authMiddleware(request, reply);
  }
});

// Swagger configuration
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "TACO-IDE API",
      description: "Backend API for TACO-IDE educational platform",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
        },
      },
    },
    tags: [
      { name: "auth", description: "Authentication endpoints" },
      { name: "users", description: "User management endpoints" },
      { name: "status", description: "Health check endpoints" },
      { name: "classrooms", description: "Classroom management and enrollment endpoints" },
      { name: "organizations", description: "Organization members and invitations" },
      { name: "chat", description: "Chat agent endpoints" },
    ],
  },
  transform: jsonSchemaTransform,
});

app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "none",
    deepLinking: true,
    displayRequestDuration: true,
    tagsSorter: "alpha",
  },
  theme: {
    css: [{ filename: "swagger-dark.css", content: darkCss }],
  },
});

// Register routes
app.register(registerRoutes);

// Export swagger.yaml when ready
app.ready((err) => {
  if (err) throw err;
  const swaggerJson = app.swagger();
  const swaggerYaml = yaml.dump(swaggerJson);
  const swaggerPath = path.join(__dirname, "..", "swagger.yaml");
  fs.writeFileSync(swaggerPath, swaggerYaml);
  console.log("📄 Swagger YAML exported to swagger.yaml");
});

export default app;
