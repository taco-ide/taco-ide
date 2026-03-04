# Unit Test Patterns

## Structure (AAA Pattern)
```typescript
import { describe, it, expect } from 'vitest'

describe('calculatePrice', () => {
  it('should return zero when quantity is zero', () => {
    // Arrange
    const input = { price: 10, quantity: 0 }

    // Act
    const result = calculatePrice(input)

    // Assert
    expect(result).toBe(0)
  })
})
```

## Naming Convention
Use descriptive `describe` + `it` blocks:
- `describe('functionName')` or `describe('ComponentName')`
- `it('should <expected behavior> when <condition>')`

Examples:
- `it('should return zero when quantity is zero')`
- `it('should throw when email format is invalid')`

## What to Test
- Happy path (normal operation)
- Edge cases (empty, null, boundary values)
- Error cases (invalid input, exceptions)

## What NOT to Test
- Private functions directly (test through public interface)
- External libraries (assume they work)
- Simple getters/setters (unless they have logic)
- Generated code (Kubb output)

## Mocking Guidelines
- Mock external dependencies (DB, API, file system)
- Don't mock the thing you're testing
- Prefer fakes over mocks when possible
- Use `vi.mock()` and `vi.fn()` from Vitest

## Fixtures
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

const sampleUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test User',
  email: 'test@example.com',
}

describe('UserService', () => {
  let mockDb: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockDb = vi.fn()
  })

  it('should find user by id', async () => {
    mockDb.mockResolvedValue(sampleUser)
    // ...test logic
  })
})
```
