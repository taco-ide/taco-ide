# src/auth - Better Auth Configuration

This directory contains Better Auth setup for email/password authentication with email verification and password reset.

## Files

### index.ts
Server-side Better Auth instance configured with:
- Email/password authentication
- Email verification
- Password reset functionality
- Resend email provider

```typescript
import { auth } from "@repo/infra/auth"

// Use in API routes
const session = await auth.api.getSession({ headers })
```

### client.ts
Client-side Better Auth instance for frontend use:

```typescript
import { authClient } from "@repo/infra/auth/client"

// Available methods
await authClient.signUp.email({ email, password, name })
await authClient.signIn.email({ email, password })
await authClient.signOut()
await authClient.getSession()
await authClient.requestPasswordReset({ email })
await authClient.resetPassword({ newPassword })
```

### email.ts
Custom email templates for Better Auth:
- Email verification
- Password reset

Uses Resend API for email delivery.

## Better Auth Configuration

### Plugins Enabled
- `emailOTPClient()` - Email OTP verification
- `emailOTP()` - Server-side OTP handling

### Database Adapter
Uses Drizzle adapter with PostgreSQL tables:
- `user`
- `session`
- `account`
- `verification`

### Authentication Flow

#### Sign Up
1. User submits name, email, password
2. Better Auth creates user and account
3. Sends verification email via Resend
4. User verifies email with OTP code
5. Account activated

#### Sign In
1. User submits email, password
2. Better Auth verifies credentials
3. Checks email verification status
4. Creates session
5. Returns session cookie

#### Password Reset
1. User requests password reset
2. Better Auth sends reset email
3. User clicks link with token
4. User submits new password
5. Password updated, user can log in

## Environment Variables

Required:
```env
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3333
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Session Management

Better Auth handles sessions via HTTP-only cookies:
- Cookie name: `better-auth.session_token`
- Secure in production (HTTPS only)
- SameSite: Lax
- 7-day expiration (configurable)

## API Routes Provided

Better Auth automatically provides these routes when registered with the API:

```
POST /v1/auth/sign-up/email     - Register new user
POST /v1/auth/sign-in/email     - Login
POST /v1/auth/sign-out          - Logout
GET  /v1/auth/session           - Get current session
POST /v1/auth/request-password-reset - Request password reset
POST /v1/auth/reset-password    - Reset password
POST /v1/auth/verify-email      - Verify email with OTP
```

## Usage in API

### Register Better Auth routes
```typescript
// In apps/api/src/http/routes/v1/auth/index.ts
import { auth } from "@repo/infra/auth"

app.all("/auth/*", async (req, reply) => {
  return auth.handler(toWebRequest(req, reply))
})
```

### Protect routes with session check
```typescript
import { auth } from "@repo/infra/auth"

const session = await auth.api.getSession({
  headers: request.headers,
})

if (!session) {
  return reply.status(401).send({ error: "Unauthorized" })
}

// Access session.user
const userId = session.user.id
```

## Usage in Web Frontend

### Sign up
```typescript
import { authClient } from "@repo/infra/auth/client"

const { data, error } = await authClient.signUp.email({
  name: "John Doe",
  email: "john@example.com",
  password: "securepassword",
  callbackURL: "/explore",
})
```

### Sign in
```typescript
const { data, error } = await authClient.signIn.email({
  email: "john@example.com",
  password: "securepassword",
  callbackURL: "/explore",
})
```

### Get current session
```typescript
const session = await authClient.getSession()
if (session) {
  console.log(session.user.name)
}
```

### Sign out
```typescript
await authClient.signOut()
```

## Email Templates

Custom email templates in `email.ts`:

### Verification Email
- Subject: "Verify your email address"
- Contains OTP code
- Expires in 15 minutes

### Password Reset Email
- Subject: "Reset your password"
- Contains reset link with token
- Expires in 15 minutes

## Security Features

- Passwords hashed with bcrypt
- Email verification required
- Session tokens are HTTP-only cookies
- CSRF protection built-in
- Rate limiting (configure as needed)

## Important Notes

- Better Auth requires specific database schema (defined in `packages/infra/src/db/schema/auth.ts`)
- Email sending requires Resend API key
- Better Auth URL must match your API base URL
- Session cookies are cross-domain compatible (for API + Web setup)
- User roles are managed separately in application logic
