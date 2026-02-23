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
Database seeding script for development data.

Run with: `npm run db:seed`

### schema/
Contains all database table definitions.

## Schema Organization

```
schema/
├── index.ts    # Re-exports all from auth.ts and app.ts
├── auth.ts     # Better Auth tables (user, session, account, verification, organization, member, invitation)
└── app.ts      # Application tables (12 tables)
```

## Database Tables

### Authentication Tables (auth.ts) - 7 tables

**user**
- `id` (PK text), `name`, `email` (unique), `emailVerified`, `image`, `isActive`, `createdAt`, `updatedAt`, `deletedAt`

**session**
- `id` (PK), `token` (unique), `userId` (FK→user), `activeOrganizationId`, `expiresAt`, `ipAddress`, `userAgent`, `createdAt`, `updatedAt`

**account**
- `id` (PK), `accountId`, `providerId`, `userId` (FK→user), `password`, `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `createdAt`, `updatedAt`

**verification**
- `id` (PK), `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`

**organization**
- `id` (PK), `name`, `slug` (unique), `logo`, `metadata`, `createdAt`

**member**
- `id` (PK), `userId` (FK→user), `organizationId` (FK→organization), `role`, `createdAt`

**invitation**
- `id` (PK), `email`, `inviterId` (FK→user), `organizationId` (FK→organization), `role`, `status` (default: pending), `expiresAt`, `createdAt`

### Application Tables (app.ts) - 12 tables

**classroom** - Classrooms within organizations
- `id`, `organizationId` (FK→organization), `title`, `description`, `createdAt`, `updatedAt`, `deletedAt`

**userClassroom** - User-classroom enrollment (M2M junction)
- `userId` (FK→user), `classroomId` (FK→classroom) - Composite PK

**model** - LLM model configurations
- `id`, `version`, `name`, `description`, `modelParameters` (JSONB), `createdAt`
- Unique index on (name, version)

**teachingAssistant** - AI teaching assistant configurations
- `id`, `alias` (varchar 50), `version`, `modelId` (FK→model), `systemPrompt`, `description`, `targetAudience`, `guardrailConfig` (JSONB), `isActive`, `createdByOrganizationId` (FK→organization), `createdAt`
- Unique index on (alias, version)

**challenge** - Programming challenges
- `id`, `classroomId` (FK→classroom), `title`, `description`, `supportMaterials` (JSONB array), `possibleSolutions` (JSONB array), `createdAt`, `updatedAt`, `deletedAt`

**challengeTeachingAssistant** - Challenge-TA mapping (M2M)
- `challengeId` (FK→challenge), `teachingAssistantId` (FK→teachingAssistant) - Composite PK
- `isDefault`, `createdAt`

**workSession** - User work sessions on challenges
- `id`, `userId` (FK→user), `challengeId` (FK→challenge), `classroomId` (FK→classroom), `teachingAssistantId` (FK→teachingAssistant), `createdAt`, `updatedAt`, `lastMessageAt`, `endedAt`

**userInteractionOnChallenge** - Chat interactions within work sessions
- `id`, `workSessionId` (FK→workSession), `challengeId` (FK→challenge), `userPrompt`, `modelResponse`, `code`, `stdin`, `stdout`, `createdAt`

**challengeSolution** - User solutions to challenges
- `id`, `userId` (FK→user), `challengeId` (FK→challenge), `chatHistory` (JSONB), `code`, `stdin`, `stdout`, `createdAt`, `updatedAt`
- Unique index on (userId, challengeId)

**knowledgeBase** - Knowledge base entries
- `id`, `organizationId` (FK→organization), `classroomId` (FK→classroom), `challengeId` (FK→challenge), `content`, `createdAt`, `updatedAt`

**conversationReplay** - Replay sessions for analysis
- `id`, `originalWorkSessionId` (FK→workSession), `replayTeachingAssistantId` (FK→teachingAssistant), `replayedAt`, `notes`
- Unique index on (originalWorkSessionId, replayTeachingAssistantId)

**replayInteraction** - Individual replay interactions
- `id`, `replayId` (FK→conversationReplay), `originalInteractionId` (FK→userInteractionOnChallenge), `userPrompt`, `modelResponse`, `createdAt`

## Type Safety

Drizzle provides type inference:

```typescript
import { db } from "@repo/infra/db"
import { schema } from "@repo/infra/db/schema"
import { eq } from "drizzle-orm"

// Query with type safety
const user = await db.query.user.findFirst({
  where: eq(schema.user.email, "user@example.com"),
})

// Insert with type safety
await db.insert(schema.user).values({
  id: "generated-id",
  name: "John Doe",
  email: "john@example.com",
  emailVerified: false,
})
```

## Key Relationships

- User → Member → Organization (via member table with role)
- Organization → Classroom → Challenge
- Challenge → TeachingAssistant (M2M via challengeTeachingAssistant)
- User → WorkSession → UserInteractionOnChallenge
- Challenge → KnowledgeBase
- WorkSession → ConversationReplay → ReplayInteraction

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
- Custom user fields (isActive) are application-specific
- Roles are managed via Organization plugin member table, not on user directly
- Use relations for type-safe joins
- Drizzle ORM uses PostgreSQL-specific types and features
