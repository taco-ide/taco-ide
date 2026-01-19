# src/lib/ Directory Guide

This directory contains utility functions, authentication logic, and shared libraries.

## Directory Structure

```
lib/
├── auth/             # Authentication-related modules
│   ├── config.ts     # Auth configuration constants
│   ├── jwt.ts        # JWT token creation and verification
│   ├── middleware.ts # Auth middleware logic
│   ├── schemas.ts    # Zod validation schemas
│   ├── utils.ts      # Auth utility functions
│   ├── client-cookies.ts  # Client-side cookie handling
│   └── server-cookies.ts  # Server-side cookie handling
└── utils.ts          # General utility functions (cn helper)
```

## Authentication Module (`auth/`)

### config.ts
Configuration constants for authentication:
```typescript
// Server-only config (JWT secret, etc.)
export const SERVER_AUTH_CONFIG = { ... }

// Shared config (token names, expiration times)
export const SHARED_AUTH_CONFIG = {
  SESSION_TOKEN_NAME: "session_token",
  VERIFICATION_TOKEN_NAME: "verification_token",
  SESSION_EXPIRATION: 7 * 24 * 60 * 60, // 7 days
  VERIFICATION_EXPIRATION: 15 * 60,     // 15 minutes
}

// Environment helpers
export function isProduction(): boolean
export function shouldUse2FA(): boolean
```

### jwt.ts
JWT token handling using `jose` library:
```typescript
// Token types
interface SessionTokenPayload {
  userId: number;
  email: string;
  name?: string;
  role: string;
}

interface VerificationTokenPayload {
  userId: number;
  email: string;
  type: "2FA" | "PASSWORD_RESET";
}

// Functions
createSessionToken(payload): Promise<string>
createVerificationToken(payload): Promise<string>
verifySessionToken(token): Promise<SessionTokenPayload>
verifyVerificationToken(token): Promise<VerificationTokenPayload>
```

### middleware.ts
Authentication middleware for protected routes:
```typescript
authMiddleware(request, publicPaths): Promise<NextResponse>
checkRole(request, allowedRoles): Promise<boolean>
```

### schemas.ts
Zod validation schemas for auth forms:
- `loginSchema` - Email, password, turnstile token
- `signupSchema` - Name, email, password, turnstile token
- Additional schemas for verification and password reset

### utils.ts
Utility functions for authentication:
```typescript
hashPassword(password): Promise<string>
verifyPassword(password, hash): Promise<boolean>
generateVerificationCode(): string
saveVerificationCode(userId, code, type): Promise<number>
sendVerificationEmail(email, code): Promise<void>
verifyTurnstileToken(token): Promise<boolean>
```

### Cookie Handling
- `client-cookies.ts` - Client-side cookie access (js-cookie)
- `server-cookies.ts` - Server-side cookie access (Next.js cookies())

## General Utilities (`utils.ts`)

```typescript
// Tailwind class name merger
import { cn } from "@/lib/utils"

// Usage
cn("base-class", conditional && "conditional-class", "override-class")
```

## Usage Examples

### Protecting an API Route
```typescript
import { verifySessionToken } from "@/lib/auth/jwt"
import { SHARED_AUTH_CONFIG } from "@/lib/auth/config"

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SHARED_AUTH_CONFIG.SESSION_TOKEN_NAME)?.value
  if (!token) return unauthorized()

  const payload = await verifySessionToken(token)
  // Use payload.userId, payload.role, etc.
}
```

### Validating Request Body
```typescript
import { loginSchema } from "@/lib/auth/schemas"

const validation = loginSchema.safeParse(body)
if (!validation.success) {
  return NextResponse.json({ error: validation.error.issues }, { status: 400 })
}
const { email, password } = validation.data
```

### Hashing Passwords
```typescript
import { hashPassword, verifyPassword } from "@/lib/auth/utils"

const hash = await hashPassword(plainPassword)
const isValid = await verifyPassword(plainPassword, storedHash)
```
