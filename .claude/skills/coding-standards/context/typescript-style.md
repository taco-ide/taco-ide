# TypeScript Style Guide

## General
- Use TypeScript strict mode
- Prefer `const` over `let`, never use `var`
- Use explicit return types on exported functions
- Maximum line length: 100 characters
- Use path aliases (`@/` for src, `@repo/` for workspace packages)

## Naming
- Variables/functions: camelCase
- Types/interfaces/components: PascalCase
- Constants: UPPER_SNAKE_CASE
- File names: kebab-case (e.g., `create-challenge.ts`)
- React components: PascalCase file names (e.g., `ChallengeCard.tsx`)

## Imports
- Workspace packages first (`@repo/infra`, `@repo/types`)
- Third-party packages second
- Local imports third (with path aliases)
- Type-only imports with `import type`

## Error Handling
- Use specific error types, not generic `Error`
- Always log errors with context
- In Fastify routes, use reply.status().send() pattern
- Let Fastify's error handler manage unexpected errors

## Zod Schemas
- Define schemas inline in route files for request/response validation
- Use `.describe()` for OpenAPI documentation
- Prefer `.transform()` over post-processing

## Type Hints
```typescript
// Fastify route handler
export async function createChallenge(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/challenges',
    {
      schema: {
        body: createChallengeBodySchema,
        response: { 201: challengeResponseSchema },
      },
    },
    async (request, reply) => {
      // handler logic
      return reply.status(201).send(result)
    },
  )
}
```
