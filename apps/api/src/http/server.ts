import { fastify } from "fastify";
import fastifyCors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyCookie from "@fastify/cookie";
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
    "X-Internal-Secret",
    "Accept",
    "Cookie",
  ],
  exposedHeaders: ["Set-Cookie"],
});

app.register(fastifyCookie);

// Global authentication hook
app.addHook("onRequest", async (request, reply) => {
  const publicRoutes = [
    "/v1/auth/",
    "/api/auth/",
    "/v1/status",
    "/v1/internal/", // Internal routes use their own auth
    "/docs",
  ];

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
      { name: "ai", description: "AI-powered features" },
      {
        name: "internal",
        description: "Internal API endpoints (AI Service only)",
      },
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
