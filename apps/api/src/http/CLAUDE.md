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

### rate-limit.ts
API rate limiting (issue #14), built on `@fastify/rate-limit` with its
in-memory LRU store. Limits come from `@repo/infra/env` (defaults below) and
are read per request from the exported `rateLimitSettings`.

| Layer | Key | Default | Applies to |
|-------|-----|---------|------------|
| Global | user id, else client IP | 300/min (`RATE_LIMIT_GLOBAL_PER_MINUTE`) | every route except the Better Auth bridge |
| `aiChat` | user id | 10/min, 200/day | `POST /v1/work-sessions/:id/chat`, `POST /v1/chat/student/message`, `POST /v1/chat/teacher/message` |
| `aiGeneration` | user id | 5/min, 100/day | reference solutions from `POST /v1/challenges` (unless `generateReferenceSolutions: false`) and `PATCH /v1/challenges/:id` (only with `generateReferenceSolutions: true`), reference-solution regenerate, auto-review re-run, the auto-review started by `POST /v1/work-sessions/:id/submit` (counted against the student) |
| `embedding` | user id | 30/min, 500/day | both knowledge base search routes, manual entry create/update, document upload |
| Better Auth | client IP + auth path | sign-in/sign-up/change-password/change-email 100/min; password reset and verification email 10/hour; other auth paths 100/10 s | `/v1/auth/*`, `/api/auth/*` (configured in `packages/infra/src/auth/index.ts`) |

- Add a cost policy to a route with `preHandler: [rateLimitPolicy("aiChat")]`
  (after `requirePermission(...)` when present). Each policy's budget is
  shared by all its routes, so it does not grow with sessions or classrooms.
  Requests that fail validation are not counted.
- When the route has its own refusals (409 already running, cooldown), call
  `consumeRateLimit(request, policy)` in the handler after them and answer
  with `sendRateLimited(reply, rejection)`, so refused requests spend no
  budget (reference-solution regenerate, auto-review re-run).
- When the costly work is optional, skip it instead of failing the request:
  challenge create/update still save and return
  `data.referenceSolutionsSkipped: { code: "RATE_LIMITED", message,
  retryAfterSeconds }` (`RateLimitedSkipSchema`); submit still succeeds and
  marks the submission's auto-review `failed` ("Auto-review skipped: …") so
  staff can re-run it.
- Over the limit: `429`, `Retry-After` and `x-ratelimit-*` headers, body
  `{ success: false, message, code: "RATE_LIMITED", retryAfterSeconds }`
  (`ResponseSchema429`). Better Auth answers its own 429 with `X-Retry-After`.
- Client IP: anonymous requests and Better Auth are keyed by `request.ip`
  (the bridge passes it to Better Auth in the `x-taco-client-ip` header).
  `TRUST_PROXY` sets Fastify's `trustProxy`: unset (default) ignores
  `X-Forwarded-For`; in production list the reverse proxy's address(es), e.g.
  `TRUST_PROXY=127.0.0.1` (nginx on the same host) or `uniquelocal` (proxy on
  a private Docker network). The IP is then the rightmost entry not added by
  a trusted proxy, so client-written entries are ignored. `true` and hop
  counts are rejected (`true` trusts the client's leftmost entry; Fastify 5
  treats hop counts as "trust nothing"). Without it, behind a proxy every
  client shares the proxy's IP.
- Better Auth's counter resets only after a full window without an allowed
  request, so its limits are per burst: once an IP reaches `max`, it waits
  until one window after its last allowed request.
- `RATE_LIMIT_ENABLED=false` turns off the API layers; Better Auth's limiter
  is off by default under `NODE_ENV=test`.
- Each limiter store is an LRU of `RATE_LIMIT_CACHE_SIZE` keys (default
  10000). When more keys are active in a window, the least recently used are
  evicted and their budgets reset; size it above the number of users active
  in a day.
- Web: `ApiError` carries `code` and `retryAfterSeconds`;
  `useApiErrorMessage()` (`apps/web/src/hooks/useApiErrorMessage.ts`) turns
  `RATE_LIMITED` into a translated "try again in …" message.
- State is per process. Before running more than one API instance, add a
  Redis store (`redis` option in `globalRateLimitOptions`, and Better Auth
  `secondaryStorage`).

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
