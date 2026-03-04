# Integration Test Patterns

## When to Use
- Testing Fastify API routes end-to-end
- Testing database operations with Drizzle
- Testing authentication flows with Better Auth
- Testing multi-component workflows

## Fastify Route Tests
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { createChallenge } from '../routes/v1/challenges/create-challenge'

describe('POST /v1/challenges', () => {
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    app = Fastify()
    await app.register(createChallenge)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should create a challenge and return 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      payload: { title: 'Test Challenge', description: 'A test' },
    })

    expect(response.statusCode).toBe(201)
    expect(JSON.parse(response.payload)).toMatchObject({
      title: 'Test Challenge',
    })
  })

  it('should return 400 for invalid body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })
})
```

## Database Tests
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@repo/infra/db'
import { challenges } from '@repo/infra/db/schema'
import { eq } from 'drizzle-orm'

describe('Challenges DB operations', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(challenges).where(eq(challenges.title, 'Test'))
  })

  it('should insert and retrieve a challenge', async () => {
    const [created] = await db
      .insert(challenges)
      .values({ title: 'Test', description: 'Test desc' })
      .returning()

    const found = await db.query.challenges.findFirst({
      where: eq(challenges.id, created.id),
    })

    expect(found).toBeDefined()
    expect(found!.title).toBe('Test')
  })
})
```

## Isolation
- Each test should be independent
- Use transactions and rollback for DB tests when possible
- Clean up any created resources
- Use unique identifiers to avoid conflicts

## Performance
- Integration tests are slower than unit tests
- Run them separately if needed
- Consider using a test database (not the dev database)
