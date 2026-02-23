# src/http/routes - API Routes

This directory contains all API route handlers organized by version and module.

## Directory Structure

```
routes/
├── _responses/      # Shared response schemas
│   └── types.ts     # Common response types
└── v1/              # API version 1
    ├── index.ts     # Route registration
    ├── auth/        # Authentication routes (Better Auth)
    ├── users/       # User management routes
    ├── status/      # Health check routes
    └── ai/          # AI-powered features
        ├── index.ts # Module registration
        └── chat.ts  # POST /v1/ai/chat
```

## _responses/

Shared response schemas for consistency:

### types.ts
```typescript
// Success responses
ResponseSchema200  // OK with data
ResponseSchema201  // Created
ResponseSchema204  // No content

// Error responses
ResponseSchema400  // Bad request
ResponseSchema401  // Unauthorized
ResponseSchema404  # Not found
ResponseSchema500  // Internal server error
```

Usage:
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

## v1/ - API Version 1

Main API routes.

### index.ts
Registers all v1 route modules and auth routes at two prefixes:

```typescript
// Auth routes registered at both prefixes
await app.register(apiAuthRoutes, { prefix: "/api" });  // /api/auth/*
await app.register(authRoutes, { prefix: "/v1" });      // /v1/auth/*

// Application routes
const routes = [usersRoutes, statusRoutes, aiRoutes];
for (const route of routes) {
  await app.register(route);
}
```

### Route Modules

Each module has:
- `index.ts` - Module route registration with prefix
- Individual route files for each endpoint

## auth/

Better Auth integration routes.

### index.ts
Registers Better Auth handler at `/auth/*`:

```typescript
app.all("/auth/*", async (req, reply) => {
  return auth.handler(toWebRequest(req, reply))
})
```

Better Auth provides these endpoints:
```
POST /v1/auth/sign-up/email     - Register
POST /v1/auth/sign-in/email     - Login
POST /v1/auth/sign-out          - Logout
GET  /v1/auth/session           - Get session
POST /v1/auth/request-password-reset - Request reset
POST /v1/auth/reset-password    - Reset password
POST /v1/auth/verify-email      - Verify email
```

## users/

User management endpoints.

### Available Routes
- `GET /v1/users/me` - Get current user info (requires auth)

```
users/
├── index.ts    # Registers all user routes
└── me.ts       # GET /me endpoint
```

## status/

Health check and monitoring routes.

### Available Routes
- `GET /v1/status` - API health check (public, no auth required)

## ai/

AI-powered features (chat with AI teaching assistant).

### Available Routes
- `POST /v1/ai/chat` - Send message for AI-generated hints (requires auth)

**Request body**:
- `workSessionId` - Active work session ID
- `code` - Student's current code
- `language` - Programming language
- `message` - Student's message (min 1 char)
- `guardrailPreset` - "loose" | "medium" | "strict" (default: "medium")

**Flow**: Fetches work session, challenge, TA config, knowledge base, and chat history from DB, then calls the Python AI service via `aiClient`.

```
ai/
├── index.ts    # Module registration with /ai prefix
└── chat.ts     # POST /chat endpoint
```

## Adding a New Module

1. **Create module directory**
   ```bash
   mkdir src/http/routes/v1/exercises
   ```

2. **Create route file**
   ```typescript
   // src/http/routes/v1/exercises/list.ts
   import { z } from "zod"
   import type { FastifyTypedInstance } from "../../../types"
   import { ResponseSchema200 } from "../../_responses/types"

   const ResponseSchema = ResponseSchema200.extend({
     data: z.array(z.object({
       id: z.number(),
       title: z.string(),
     })),
   })

   export async function listExercises(app: FastifyTypedInstance) {
     app.get(
       "/list",
       {
         schema: {
           tags: ["exercises"],
           description: "List all exercises",
           response: {
             200: ResponseSchema,
           },
         },
       },
       async (request, reply) => {
         // Implementation
         return reply.send({
           success: true,
           data: [],
         })
       }
     )
   }
   ```

3. **Create module index**
   ```typescript
   // src/http/routes/v1/exercises/index.ts
   import type { FastifyTypedInstance } from "../../../types"
   import { listExercises } from "./list"
   import { createExercise } from "./create"

   export async function exercisesRoutes(app: FastifyTypedInstance) {
     await app.register(
       async (fastify) => {
         await listExercises(fastify)
         await createExercise(fastify)
       },
       { prefix: "/exercises" }
     )
   }
   ```

4. **Register in v1/index.ts**
   ```typescript
   import { exercisesRoutes } from "./exercises"

   const routes = [
     // ... existing routes
     exercisesRoutes,
   ]
   ```

5. **Run Kubb to generate types**
   ```bash
   npm run kubb
   ```

## Route File Naming

- Use descriptive names: `list.ts`, `create.ts`, `update.ts`, `delete.ts`
- One route handler per file for clarity
- Group related routes in modules

## Protected Routes

Use auth middleware for protected endpoints:

```typescript
import { authMiddleware } from "../../../middlewares/auth"

export async function protectedRoutes(app: FastifyTypedInstance) {
  await app.register(
    async (fastify) => {
      fastify.addHook("onRequest", authMiddleware)

      // All routes here require authentication
      await myProtectedRoute(fastify)
    },
    { prefix: "/protected" }
  )
}
```

## Request Validation

Always define Zod schemas:

```typescript
const CreateSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
})

app.post("/create", {
  schema: {
    body: CreateSchema,  // Validates request body
    response: { ... },
  }
}, handler)
```

Fastify automatically validates and returns 400 if invalid.

## Response Structure

All responses follow this structure:

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  message: "Error description"
}
```

## Important Notes

- Use semantic HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes (200, 201, 400, 401, 404, 500)
- Always validate input with Zod schemas
- Tag routes for Swagger organization
- Use shared response schemas for consistency
- Run `npm run kubb` after adding/modifying routes
- Test routes via Swagger UI at `/docs`
