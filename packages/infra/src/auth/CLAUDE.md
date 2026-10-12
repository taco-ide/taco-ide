# src/auth - Better Auth Configuration

This directory contains Better Auth setup for email/password authentication with email verification and password reset.

## Files

### index.ts
Server-side Better Auth instance configured with:
- Email/password authentication
- Email verification
- Password reset functionality
- Organization membership and creation policy
- Resend email provider (development links are logged when no key is configured)

```typescript
import { auth } from "@repo/infra/auth"

// Use in API routes
const session = await auth.api.getSession({ headers })
```

### boundaries.ts
Checks current account eligibility in the database and rejects administrative user fields in self-service requests.

### client.ts
Client-side Better Auth instance with the organization plugin for frontend use:

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
- `organization()` - Server-side organization roles and membership
- `organizationClient()` - Browser organization operations

No email OTP plugin is configured. Verification and password reset use links with tokens.

### Database Adapter
Uses Drizzle adapter with PostgreSQL tables:
- `user`
- `session`
- `account`
- `verification`
- `organization`
- `member`
- `invitation`

### Authentication Flow

#### Sign Up
1. User submits name, email, password
2. Better Auth creates user and account
3. Sends verification email via Resend
4. User follows the email-verification link
5. Email marked verified; verification is required for login in production

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
BETTER_AUTH_URL=http://localhost:4000
```

`FRONTEND_URL` defaults to `http://localhost:4001`. `RESEND_API_KEY` is optional in development; configure it for real email delivery. Shared environment validation also requires `DATABASE_URL` and `LLM_API_KEY`.

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
GET  /v1/auth/get-session       - Get current session
POST /v1/auth/request-password-reset - Request password reset
POST /v1/auth/reset-password    - Reset password
GET  /v1/auth/verify-email      - Follow email-verification link
POST /v1/auth/update-user       - Update the current public profile
```

The browser uses `/api/auth/*`; Fastify maps `/v1/auth/*` to the same Better Auth handler. Both prefixes share the same guards.

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
- Subject: "Verify your email - TACO-IDE"
- Contains a verification link with a token
- Expiry follows Better Auth configuration

### Password Reset Email
- Subject: "Reset your password - TACO-IDE"
- Contains reset link with token
- Expiry follows Better Auth configuration

## Security Features

- Passwords hashed with Better Auth's scrypt implementation
- Email verification required for login in production
- Session tokens are HTTP-only cookies
- CSRF protection built-in
- Rate limiting (configure as needed)

## Self-Service and Organization-Creation Boundaries

- Signup and profile updates reject `isActive`, `deletedAt`, and `isPlatformAdmin` with HTTP 400, including `false` and `null`, before any profile/account write. All three additional fields also use `input: false`.
- Normal signup creates an active account without platform-admin privileges. Active users may still change their name and image.
- Profile writes require a valid session and an active, non-deleted account loaded from the database. Cookies issued before deactivation cannot authorize these writes.
- Organization creation requires an active, non-deleted platform admin loaded from the current database row. Organization-level `admin` membership is not sufficient. Allowed creators receive the plugin's `admin` role.
- The creation callback throws on denied eligibility so the same policy applies to server-only `userId` calls. Session-cookie caching cannot retain revoked creation privileges.
- Administrative changes remain in dedicated management routes or trusted database operations. A Better Auth session alone is not sufficient application authorization.

See `docs/security/auth-boundaries.md` for the policy and real integration coverage of both auth aliases.

## Important Notes

- Better Auth requires specific database schema (defined in `packages/infra/src/db/schema/auth.ts`)
- Production email delivery requires a Resend API key; development without a key logs links
- Better Auth URL must match your API base URL
- Session cookies are cross-domain compatible (for API + Web setup)
- User roles are managed separately in application logic
