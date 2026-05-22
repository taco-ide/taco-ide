# src/http - HTTP Layer

This directory contains all HTTP-related code: server configuration, middleware, routes, and types.

## Directory Structure

```
http/
├── server.ts        # Fastify server setup and configuration
├── types.ts         # FastifyTypedInstance type definition
├── @types/          # TypeScript type extensions
│   └── fastify.d.ts # Augmented Fastify types
├── middlewares/     # Middleware functions
│   └── auth.ts      # Authentication middleware
└── routes/          # Route handlers
    ├── _responses/  # Shared response schemas
    └── v1/          # API version 1 routes
```

## server.ts

Fastify server configuration and setup:

### Features Configured
- **Zod Type Provider** - Type-safe request/response validation
- **CORS** - Cross-origin requests for web frontend
- **Cookie Support** - Session cookies for Better Auth
- **Swagger** - Auto-generated API documentation
- **Swagger UI** - Interactive API explorer

### Swagger Configuration
- UI at: `/docs`
- JSON spec at: `/docs/json`
- YAML spec written to: `src/swagger.yaml`

### Server Factory
```typescript
export async function buildServer(): Promise<FastifyTypedInstance>
```

Returns configured Fastify instance ready to register routes.

## types.ts

Defines `FastifyTypedInstance` - the Fastify instance with Zod type provider:

```typescript
import type { FastifyTypedInstance } from "./types"

export async function myRoute(app: FastifyTypedInstance) {
  app.get("/path", { schema: { ... } }, handler)
}
```

## @types/fastify.d.ts

TypeScript augmentation for Fastify:
- Adds custom properties to request/reply
- Enables type-safe access to Better Auth session

## middlewares/

Reusable middleware functions.

### auth.ts
Authentication middleware using Better Auth:

```typescript
import { authMiddleware } from "../middlewares/auth"

// Apply to protected routes
app.register(async (fastify) => {
  fastify.addHook("onRequest", authMiddleware)

  // Protected routes here
}, { prefix: "/protected" })
```

Middleware behavior:
- Checks for valid session
- Returns 401 if unauthenticated
- Attaches user info to request context

## routes/

Route handlers organized by version and module.

### _responses/
Shared response schemas used across routes:

```typescript
import { ResponseSchema201, ResponseSchema400 } from "../_responses/types"

app.post("/endpoint", {
  schema: {
    response: {
      201: ResponseSchema201,
      400: ResponseSchema400,
    }
  }
}, handler)
```

### v1/
API version 1 routes. See `routes/CLAUDE.md` for detailed structure.

## Route Definition Pattern

Standard pattern for defining routes:

```typescript
import { z } from "zod"
import type { FastifyTypedInstance } from "../../types"
import { ResponseSchema201, ResponseSchema400 } from "../_responses/types"

const RequestSchema = z.object({
  name: z.string().min(2),
})

const ResponseSchema = ResponseSchema201.extend({
  data: z.object({
    id: z.number(),
    name: z.string(),
  }),
})

export async function myRoute(app: FastifyTypedInstance) {
  app.post(
    "/path",
    {
      schema: {
        tags: ["module-name"],
        description: "Route description",
        body: RequestSchema,
        response: {
          201: ResponseSchema,
          400: ResponseSchema400,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body  // Typed!

      // Logic here

      return reply.status(201).send({
        success: true,
        data: { id: 1, name },
      })
    }
  )
}
```

## Swagger Tags

Organize routes with tags:
- `auth` - Authentication endpoints
- `users` - User management
- `status` - Health checks
- (Add more as needed)

Tags appear as sections in Swagger UI.

## Type Safety

The entire HTTP layer is type-safe:
1. Zod schemas define runtime validation
2. TypeScript infers types from schemas
3. Request/response bodies are fully typed
4. No type casting needed

## CORS Configuration

Configured in `server.ts` for local development:
- Origin: `http://localhost:4001` (Next.js frontend)
- Credentials: `true` (allow cookies)
- Methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS`

Update for production deployment.

## Important Notes

- Always use `FastifyTypedInstance` type for route files
- Define Zod schemas for all request/response bodies
- Use shared response schemas from `_responses/`
- Tag routes for Swagger organization
- Middleware runs before route handlers
- Better Auth routes are registered at `/v1/auth/*`
