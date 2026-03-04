# Common Design Patterns

## Fastify Route Plugin Pattern
Register routes as Fastify plugins with inline Zod schemas.

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

const responseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
})

export async function createChallenge(app: FastifyInstance) {
  app.post(
    '/v1/challenges',
    {
      schema: {
        body: bodySchema,
        response: { 201: responseSchema },
      },
    },
    async (request, reply) => {
      const { title, description } = request.body
      const result = await db.insert(challenges).values({ title, description }).returning()
      return reply.status(201).send(result[0])
    },
  )
}
```

## Drizzle ORM Query Pattern
Use Drizzle's query builder for database access directly in route handlers.

```typescript
import { db } from '@repo/infra/db'
import { challenges } from '@repo/infra/db/schema'
import { eq } from 'drizzle-orm'

// Select
const challenge = await db.query.challenges.findFirst({
  where: eq(challenges.id, id),
  with: { solutions: true },
})

// Insert
const [created] = await db.insert(challenges).values({ title }).returning()

// Update
await db.update(challenges).set({ title }).where(eq(challenges.id, id))

// Delete
await db.delete(challenges).where(eq(challenges.id, id))
```

## Kubb Code Generation Flow
After changing API route schemas:
1. Update route file with new Zod schemas
2. Run `cd apps/api && npm run kubb`
3. Generated outputs:
   - `packages/types/kubb/` - TypeScript types
   - `apps/web/src/kubb/hooks/` - React Query hooks
   - `apps/api/src/gen/kubb/zod/` - Zod schemas

## Better Auth Integration
```typescript
// Server-side (API)
import { auth } from '@repo/infra/auth'

// Client-side (Web)
import { authClient } from '@repo/infra/auth/client'
```

## Anti-Patterns to Avoid
- God components (do too much)
- Circular dependencies between workspace packages
- Hardcoded configuration (use env.ts validation)
- Business logic in React components (use route handlers or Zustand stores)
- Direct database access outside of API routes
- Skipping Kubb regeneration after schema changes
