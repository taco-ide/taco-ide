# Approved Design Patterns

## Layered Architecture
```
┌─────────────────────────────────────┐
│        Frontend (Next.js)           │  (React components, pages)
├─────────────────────────────────────┤
│     Generated Client (Kubb)         │  (React Query hooks, types)
├─────────────────────────────────────┤
│       API Routes (Fastify)          │  (Route handlers, Zod validation)
├─────────────────────────────────────┤
│       Database (Drizzle ORM)        │  (Schema, queries, PostgreSQL)
└─────────────────────────────────────┘
```

## Key Principles

### Separation of Concerns
- Each layer has a single responsibility
- Frontend consumes generated hooks, never calls DB directly
- API routes handle validation and business logic
- Drizzle schema is the single source of truth for data structure

### Schema-First Development
- Define Zod schemas in route files for request/response
- Kubb generates TypeScript types and React Query hooks from OpenAPI
- Drizzle schema defines database structure
- Keep all three in sync when making changes

### Code Generation Over Manual Types
- Never manually write API client code
- Run `npm run kubb` after route changes
- Generated code lives in `packages/types/kubb/` and `apps/web/src/kubb/hooks/`

### Authentication
- Better Auth handles all auth flows
- Session-based authentication via cookies
- Auth middleware applied at route level
- Server: `@repo/infra/auth`, Client: `@repo/infra/auth/client`

## Anti-Patterns to Avoid
- God components (do too much)
- Circular dependencies between packages
- Hardcoded configuration (use env validation)
- Business logic in React components
- Direct database access outside API routes
- Manual API client code (use Kubb generation)
- Skipping Kubb regeneration after schema changes
