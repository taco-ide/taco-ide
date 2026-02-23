# src/lib/ Directory Guide

This directory contains utility functions and shared libraries.

## Directory Structure

```
lib/
├── auth.ts       # Better Auth client re-export
├── apiClient.ts  # API client for Fastify backend
├── schemas.ts    # Zod validation schemas
└── utils.ts      # General utility functions (cn helper)
```

## Files

### auth.ts
Re-exports Better Auth client from `@repo/infra`:

```typescript
import { authClient } from "@/lib/auth"

// Available methods
await authClient.signUp.email({ email, password, name })
await authClient.signIn.email({ email, password })
await authClient.signOut()
await authClient.getSession()
await authClient.requestPasswordReset({ email })
await authClient.resetPassword({ newPassword })
```

Better Auth handles all authentication:
- Session management via HTTP-only cookies
- Email/password authentication
- Email verification
- Password reset

### apiClient.ts
Kubb-compatible fetch wrapper for API calls to the Fastify backend:

```typescript
import { client } from "@/lib/apiClient"

// Kubb-compatible interface: RequestConfig<T> => { data: T }
// Used by generated Kubb hooks automatically
```

Features:
- Automatic base URL (`NEXT_PUBLIC_API_URL`)
- Kubb-compatible `RequestConfig<T>` interface
- Error handling with `ApiError` class
- Credentials included (cookies)
- Supports GET, POST, PUT, PATCH, DELETE

### schemas.ts
Zod validation schemas for forms:

```typescript
import { loginSchema, signupSchema } from "@/lib/schemas"

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Signup schema
const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})
```

Used with React Hook Form for validation.

### utils.ts
General utility functions:

```typescript
import { cn } from "@/lib/utils"

// Tailwind class name merger
cn("base-class", conditional && "conditional-class", "override-class")
```

The `cn` function merges Tailwind classes intelligently, handling conflicts.

## Usage Examples

### Making Authenticated API Calls
```typescript
import { authClient } from "@/lib/auth"
import { apiClient } from "@/lib/apiClient"

// Sign in first
await authClient.signIn.email({ email, password })

// Session cookie is automatically included in subsequent requests
const user = await apiClient.get("/v1/users/me")
```

### Form Validation
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema } from "@/lib/schemas"

const form = useForm({
  resolver: zodResolver(loginSchema),
  defaultValues: {
    email: "",
    password: "",
  },
})

const onSubmit = form.handleSubmit(async (data) => {
  await authClient.signIn.email(data)
})
```

### Checking Authentication Status
```typescript
import { authClient } from "@/lib/auth"

const session = await authClient.getSession()

if (session) {
  console.log("Authenticated as:", session.user.name)
} else {
  console.log("Not authenticated")
}
```

## Important Notes

- Authentication is handled entirely by Better Auth (no custom JWT logic)
- Better Auth manages sessions via HTTP-only cookies
- API client automatically includes credentials (cookies) in requests
- All auth operations go through the Fastify backend
- Email verification and password reset are built into Better Auth
- Use `authClient` for auth operations, `apiClient` for other API calls
