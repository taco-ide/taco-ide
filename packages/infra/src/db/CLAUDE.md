# src/db - Database Layer

This directory contains the Drizzle ORM configuration, schema definitions, and database utilities.

## Files

### index.ts
Database connection and Drizzle instance:
```typescript
import { db } from "@repo/infra/db"

// Use the db instance for queries
const result = await db.select().from(schema.user)
```

### seed.ts
Database seeding script that creates:
- Default roles (Teacher, Student)
- Example users for development

Run with: `npm run db:seed`

### schema/
Contains all database table definitions.

## Schema Organization

```
schema/
├── index.ts    # Exports all schemas
├── auth.ts     # Better Auth tables (user, session, account, verification)
└── app.ts      # Application tables (role, knowledgeBase, document, knowledgeBaseChunk, challengeKnowledgeBase, etc.)
```

## Database Tables

### Authentication Tables (auth.ts)

Required by Better Auth:

**user**
- `id` - Primary key (text)
- `name` - User full name
- `email` - Unique email
- `emailVerified` - Email verification status
- `image` - Profile image URL
- `roleId` - Foreign key to role table
- `isActive` - Account active status
- `createdAt`, `updatedAt` - Timestamps

**session**
- `id` - Primary key
- `token` - Unique session token
- `userId` - Foreign key to user
- `expiresAt` - Session expiration
- `ipAddress`, `userAgent` - Client info
- `createdAt`, `updatedAt`

**account**
- `id` - Primary key
- `userId` - Foreign key to user
- `providerId` - Auth provider (email, google, etc.)
- `password` - Hashed password (for email/password auth)
- `accessToken`, `refreshToken` - OAuth tokens
- `createdAt`, `updatedAt`

**verification**
- `id` - Primary key
- `identifier` - Email or user ID
- `value` - Verification code/token
- `expiresAt` - Code expiration
- `createdAt`, `updatedAt`

### Application Tables (app.ts)

**role**
- `id` - Serial primary key
- `name` - Role name (unique)

Seeded roles: "Teacher", "Student"

### Knowledge Base Tables (app.ts)

**knowledgeBase** (container entity, linked to classroom)
- `id` - UUID primary key
- `name` - Display name
- `description` - Optional description
- `classroomId` - Foreign key to classroom (required)
- `organizationId` - Foreign key to organization
- `createdByUserId` - Foreign key to user who created it
- `createdAt`, `updatedAt` - Timestamps

**document** (uploaded file with staged processing)
- `id` - UUID primary key
- `knowledgeBaseId` - Foreign key to knowledgeBase
- `organizationId` - Foreign key to organization
- `fileName`, `fileType`, `fileSize` - File metadata
- `status` - Processing stage: `uploading|converting|chunking|embedding|ready|error`
- `errorStage` - Which stage failed (null if no error)
- `createdAt`, `updatedAt` - Timestamps

**knowledgeBaseChunk** (text chunks with embeddings)
- `id` - UUID primary key
- `knowledgeBaseId` - Foreign key to knowledgeBase
- `documentId` - Foreign key to document
- `content` - Text content of the chunk
- `embedding` - pgvector embedding for semantic search
- `metadata` - JSONB metadata
- `createdAt` - Timestamp

**challengeKnowledgeBase** (M2M join table)
- `challengeId` - Foreign key to challenge
- `knowledgeBaseId` - Foreign key to knowledgeBase
- Composite primary key on both columns

## Type Safety

Drizzle provides type inference:

```typescript
import type { User, NewUser, Session } from "@repo/infra/db/schema"

// For inserts
const newUser: NewUser = {
  name: "John Doe",
  email: "john@example.com",
}

// For selects
const user: User = await db.query.user.findFirst()
```

## Common Queries

### Find user by email
```typescript
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"
import { eq } from "drizzle-orm"

const user = await db.query.user.findFirst({
  where: eq(schema.user.email, "user@example.com"),
  with: {
    role: true,  // Include role relation
  },
})
```

### Create user with role
```typescript
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"

await db.insert(schema.user).values({
  id: "generated-id",
  name: "John Doe",
  email: "john@example.com",
  emailVerified: false,
  roleId: 1,  // Student or Teacher
})
```

### Update user
```typescript
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"
import { eq } from "drizzle-orm"

await db
  .update(schema.user)
  .set({ emailVerified: true })
  .where(eq(schema.user.id, userId))
```

## Relations

Defined using Drizzle relations:

```typescript
// User belongs to one role
userRelations: user -> role (one-to-one)

// Role has many users
roleRelations: role -> users (one-to-many)

// Knowledge Base relations
knowledgeBase -> classroom (many-to-one)
knowledgeBase -> user via createdByUserId (many-to-one)
knowledgeBase -> documents (one-to-many)
knowledgeBase -> knowledgeBaseChunks (one-to-many)
knowledgeBase -> challenges via challengeKnowledgeBase (many-to-many)

// Challenge <-> Knowledge Base (M2M via challengeKnowledgeBase)
challenge -> knowledgeBases via challengeKnowledgeBase (many-to-many)
```

Query with relations:
```typescript
const user = await db.query.user.findFirst({
  with: { role: true },
})
// user.role is now populated
```

## Schema Changes

### Adding a new table
1. Create table in `schema/app.ts` or new file
2. Export from `schema/index.ts`
3. Run `npm run db:generate` to create migration
4. Run `npm run db:migrate` to apply

### Adding a column
1. Modify table definition
2. Run `npm run db:generate`
3. Review generated migration in `drizzle/`
4. Run `npm run db:migrate`

### Development shortcut
For rapid prototyping, use `npm run db:push` to skip migration files.

## Drizzle Studio

Visual database editor:
```bash
npm run db:studio
```
Opens at: https://local.drizzle.studio

## Important Notes

- Better Auth requires specific table/column names - don't rename auth tables
- Always use `emailVerified` (camelCase) not `email_verified` for Better Auth compatibility
- Custom user fields (roleId, isActive) are application-specific
- Use relations for type-safe joins
- Drizzle ORM uses PostgreSQL-specific types and features
