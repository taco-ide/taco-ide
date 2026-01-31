# Database Schema Changes

## Overview
Merged the initial schema draft with requirements from Issue #7 (taco-ide/dummy-ta#7) to create a comprehensive database architecture. Subsequently refactored to support multi-organization users, OAuth authentication, and expanded role hierarchy.

## Key Changes

### 1. **Users Table** - Refactored
**Added:**
- `email` (TEXT NOT NULL) - User authentication
- `password_hash` (TEXT) - Encrypted password storage (nullable for OAuth-only users)
- Partial unique index on email (`WHERE deleted_at IS NULL`) - allows email reuse after soft-delete

**Removed:**
- `organization_id` - Users now belong to organizations via `affiliations` table
- `role` - Roles are now per-affiliation, not per-user

**Changed:**
- `password_hash` is now nullable to support OAuth-only authentication without password

**Rationale:** Users can belong to multiple organizations with different roles in each. A teacher at one school can be a student at another. OAuth-only users (Google, GitHub) don't need password-based authentication, so password_hash can be NULL.

---

### 2. **Affiliations Table** - NEW
**Fields:**
- `organization_id` (UUID PK, FK → organizations)
- `user_id` (UUID PK, FK → users)
- `role` (user_role NOT NULL) - student, teacher, coordinator, admin
- `created_at`, `updated_at`, `deleted_at` (soft delete)

**Rationale:** Many-to-many relationship between users and organizations. Each affiliation has its own role, enabling users to have different permissions in different organizations.

---

### 3. **Providers Table** - NEW (OAuth)
**Fields:**
- `user_id` (UUID PK, FK → users)
- `provider_name` (TEXT PK) - e.g., "google", "github"
- `provider_user_id` (TEXT NOT NULL)
- `access_token`, `refresh_token`, `id_token` (TEXT)
- `access_token_expires_at`, `refresh_token_expires_at` (TIMESTAMPTZ)
- `scope` (TEXT)
- Unique constraint on (provider_name, provider_user_id)

**Rationale:** Support OAuth login (Google, GitHub, etc.) alongside password authentication.

---

### 4. **Sessions Table** - NEW (Auth)
**Fields:**
- `id` (UUID PK)
- `user_id` (UUID FK → users)
- `expires_at` (TIMESTAMPTZ NOT NULL)
- `token` (TEXT UNIQUE NOT NULL)
- `ip_address`, `user_agent` (TEXT)

**Rationale:** Auth session management with token-based authentication. Tracks login sessions separately from challenge work sessions.

---

### 5. **Verifications Table** - NEW
**Fields:**
- `id` (UUID PK)
- `identifier` (TEXT NOT NULL) - email or other identifier
- `value` (TEXT NOT NULL) - verification code/token
- `expires_at` (TIMESTAMPTZ NOT NULL)

**Rationale:** Email verification, password reset, and other verification flows.

---

### 6. **User Role Enum** - Expanded
**Changed from:** `('student', 'teacher')`
**Changed to:** `('student', 'teacher', 'coordinator', 'admin')`

**Role hierarchy:** admin > coordinator > teacher > student
- **Student**: Enroll and participate in classrooms
- **Teacher**: Create and manage classrooms and challenges
- **Coordinator**: Manage users and roles within their organization
- **Admin**: Full system access, can create organizations

---

### 7. **Classrooms Table** - Enhanced
**Added:**
- `description` (TEXT) - Detailed classroom description

**Changed:**
- `classroom_id` now nullable in work_sessions (allows standalone challenges)

**Rationale:** Aligns with Issue #7 requirement to support challenges both within and outside of classrooms. Renamed from "classes" to "classrooms" to avoid conflicts with reserved keywords in programming languages.

---

### 8. **User-Classrooms Join Table** - Enhanced
**Added:**
- `enrolled_at` (TIMESTAMPTZ) - Track enrollment date
- `deleted_at` (TIMESTAMPTZ) - Soft delete preserves enrollment history

**Rationale:** Useful for analytics and access control based on enrollment periods. Soft delete allows tracking when students unenrolled.

---

### 9. **Models Table** - NEW
**Fields:**
- `id` (UUID PK)
- `version` (TEXT NOT NULL)
- `name` (TEXT NOT NULL)
- `description` (TEXT)
- `created_at` (TIMESTAMPTZ)
- Unique constraint on (name, version)

**Rationale:** From Issue #7 - track available LLM models/versions (Claude 3.5, GPT-4, etc.). Decoupled from challenges to enable flexible teaching assistant configurations.

---

### 10. **Teaching Assistants Table** - NEW (CRITICAL)
**Fields:**
- `id` (UUID PK)
- `alias` (VARCHAR(50) NOT NULL) - Friendly name like "Bob", "Alice"
- `version` (INTEGER NOT NULL) - Versioning for prompt evolution
- `model_id` (UUID FK → models)
- `system_prompt` (TEXT NOT NULL) - The core pedagogical strategy
- `description` (TEXT) - What changed in this version
- `target_audience` (VARCHAR(50)) - e.g., "beginner", "advanced"
- `is_active` (BOOLEAN DEFAULT false) - Only one version per alias can be active
- Unique constraint on (alias, version)

**Rationale:** **Teaching Assistant abstraction is the core innovation** - separates model selection from prompt engineering. Each TA is a versioned combination of (model + system_prompt + metadata). This enables:
- **Prompt Evolution**: Bob v1 → Bob v2 → Bob v3 with tracked changes
- **A/B Testing**: Compare different pedagogical approaches
- **Specialization**: Different TAs for beginners vs. advanced students
- **Reproducibility**: Exact TA version used for each session is tracked

**Example:** Bob v1 might use Claude Sonnet with "You are a helpful assistant who gives direct answers", while Bob v2 uses the same model but with "You are a Socratic tutor who guides through questions". By versioning, we can measure which approach helps students learn better.

---

### 11. **Challenge Teaching Assistants Table** - NEW
**Fields:**
- `challenge_id` (UUID PK, FK → challenges)
- `teaching_assistant_id` (UUID PK, FK → teaching_assistants)
- `is_default` (BOOLEAN DEFAULT false) - Which TA is shown first
- `created_at` (TIMESTAMPTZ)
- Unique partial index on `challenge_id WHERE is_default = true` - ensures at most one default TA per challenge

**Rationale:** Many-to-many relationship enables **flexible TA assignment**:
- One challenge can have multiple TAs (e.g., "Beginner Bob" and "Advanced Alice")
- Students can switch between TAs during a work session
- Teachers can experiment with different TAs for the same problem
- Default flag indicates which TA students see initially
- Database-level constraint prevents ambiguity by ensuring only one TA can be default per challenge

---

### 12. **Challenges Table** - Significantly Enhanced
**Added:**
- `title` (TEXT NOT NULL) - Challenge title
- `support_materials` (JSONB) - Reference documents/materials
- `possible_solutions` (JSONB) - Teacher's reference implementations
- `deleted_at` (TIMESTAMPTZ) - Soft delete support

**Changed:**
- `classroom_id` now nullable - standalone challenges are accessible by any organization

**Removed:**
- `model_id` - No longer directly tied to a model; instead linked via teaching_assistants

**Rationale:** Issue #7 requirements for teachers to provide reference materials and example solutions for better LLM context. Standalone challenges enable shared practice problems across organizations. Challenges are now **TA-agnostic** - the same problem can be attempted with different teaching assistants, enabling pedagogical experimentation.

---

### 13. **Work Sessions Table** - Renamed & Enhanced
**Renamed from:** `sessions` → `work_sessions`

**Added:**
- `teaching_assistant_id` (UUID FK → teaching_assistants) - Which TA the student is using
- `last_message_at` (TIMESTAMPTZ) - Track most recent interaction
- `ended_at` (TIMESTAMPTZ) - Track when session closed

**Changed:**
- `classroom_id` now nullable - aligns with standalone challenges

**Rationale:** Renamed to distinguish from auth sessions. Tracks a user's work session on a specific challenge. **Now records which TA was selected**, enabling analysis of TA effectiveness and student preferences. The `last_message_at` field helps identify abandoned sessions.

---

### 14. **User Interactions on Challenges Table** - NEW (CRITICAL)
**Renamed from:** `llm_interactions` → `user_interactions_on_challenges`

**Fields:**
- `id` (UUID PK)
- `work_session_id` (UUID FK → work_sessions, CASCADE DELETE)
- `challenge_id` (UUID FK → challenges)
- `user_prompt` (TEXT NOT NULL) - Student's question
- `model_response` (TEXT NOT NULL) - TA's answer
- `code` (TEXT) - Code snapshot at interaction time
- `stdin` (TEXT) - Input for code execution
- `stdout` (TEXT) - Output from code execution
- `created_at` (TIMESTAMPTZ)

**Rationale:** THE CORE FEATURE - stores the entire student-TA conversation history. Teachers evaluate learning progress by reviewing this interaction history, not test case results. The teaching assistant used is determined via `work_sessions.teaching_assistant_id`.

---

### 15. **Challenge Solutions Table** - Redesigned
**Added:**
- `chat_history` (JSONB) - Cached conversation snapshot
- `code`, `stdin`, `stdout` (TEXT) - Cached execution state

**Changed:**
- Removed `class_id` FK (redundant via challenge)
- Removed `work_session_id` FK (current solution transcends work sessions)
- Added `UNIQUE (user_id, challenge_id)` - One current solution per user per challenge

**Rationale:** Simplified to store ONLY the latest solution. Students reopen challenges and load their most recent work. **Now includes cached state** (chat history, code snapshots) for faster loading. Historical evolution is tracked via `user_interactions_on_challenges` linked to work sessions, eliminating the need for a separate history table.

---

### 16. **Knowledge Base Table** - Enhanced
**Added:**
- `challenge_id` (UUID FK → challenges) - Challenge-specific context
- HNSW vector index on `embedding` field using `vector_cosine_ops` - High-performance similarity search

**Rationale:** Teachers can provide:
- Organization-level knowledge (general programming concepts)
- Classroom-level knowledge (course-specific materials)
- Challenge-level knowledge (specific problem context)

This enables precise RAG retrieval for LLM assistance. The HNSW (Hierarchical Navigable Small World) vector index dramatically improves query performance for similarity searches, preventing full table scans on the embeddings column. Without this index, RAG queries would be prohibitively slow as the knowledge base grows.

---

### 17. **Conversation Replays Table** - NEW (A/B Testing)
**Fields:**
- `id` (UUID PK)
- `original_work_session_id` (UUID FK → work_sessions, ON DELETE CASCADE)
- `replay_teaching_assistant_id` (UUID FK → teaching_assistants, ON DELETE RESTRICT)
- `replayed_at` (TIMESTAMPTZ DEFAULT now())
- `notes` (TEXT) - Why this replay was conducted
- Unique constraint on (original_work_session_id, replay_teaching_assistant_id)

**Foreign Key Behaviors:**
- `ON DELETE CASCADE` for work_sessions: If the original session is deleted, replays become meaningless and should also be deleted
- `ON DELETE RESTRICT` for teaching_assistants: Prevents deletion of TAs that have been used in replays, preserving research data integrity

**Rationale:** **Enables A/B testing of teaching assistants** by replaying historical student conversations with different TA configurations. This answers critical questions: "Would Bob v2 have helped this struggling student better than Bob v1?" or "Is Alice's Socratic approach more effective than Bob's direct approach?"

**Use Case Example:**
1. Student works on a challenge with **Bob v1** (prompt: "You are a helpful assistant...")
2. We later create **Bob v2** with improved prompt (prompt: "You are a code writer who guides students...")
3. We replay the original student messages through Bob v2 to generate counterfactual responses
4. We compare side-by-side: did Bob v2 give better hints? fewer confusing answers?

**Key Design Decisions:**
- **Manual/Teacher-Initiated**: Replays are triggered intentionally, not automatic
- **One replay per (work session, TA) pair**: Unique constraint prevents duplicate experiments
- **Metadata Storage**: `notes` field explains the hypothesis being tested
- **Future Extensions**: Could add `total_tokens`, `total_cost` for cost analysis

---

### 18. **Replay Interactions Table** - NEW (A/B Testing)
**Fields:**
- `id` (UUID PK)
- `replay_id` (UUID FK → conversation_replays, CASCADE DELETE)
- `original_interaction_id` (UUID FK → user_interactions_on_challenges)
- `user_prompt` (TEXT NOT NULL) - Student's original question
- `model_response` (TEXT NOT NULL) - TA's counterfactual answer
- `code`, `stdin`, `stdout` (TEXT) - Execution state during replay
- `created_at` (TIMESTAMPTZ)

**Rationale:** Stores the actual counterfactual messages generated during replay experiments. Mirrors the structure of `user_interactions_on_challenges` to enable side-by-side comparison.

**Why Separate from Conversation Replays?**
- Follows the same pattern as `work_sessions` → `user_interactions_on_challenges`
- One replay event contains many replayed messages, so we normalize to avoid repeating metadata
- Separates replay **metadata** (when, why, which TA) from replay **content** (actual messages)

**Why Denormalize `user_prompt`?**
- Store `user_prompt` in `replay_interactions` even though it exists in `user_interactions_on_challenges`
- **LGPD Protection**: If original interaction is deleted/anonymized for privacy compliance, replays remain intact
- Enables standalone analysis of replay results without depending on original data

**Workflow Example:**
```sql
-- 1. Select a work session to replay (e.g., struggling student with Bob v1)
-- 2. Create replay event
INSERT INTO conversation_replays (original_work_session_id, replay_teaching_assistant_id, notes)
VALUES ('session-123', 'bob-v2-id', 'Testing improved hint quality');

-- 3. For each student message in original work session, generate Bob v2 response
-- 4. Store in replay_interactions with link to original interaction

-- 5. Compare results side-by-side
SELECT 'Original' as version, model_response
FROM user_interactions_on_challenges WHERE work_session_id = 'session-123'
UNION ALL
SELECT 'Replay' as version, model_response
FROM replay_interactions ri
JOIN conversation_replays cr ON ri.replay_id = cr.id
WHERE cr.original_work_session_id = 'session-123';
```

---

### 19. **TIMESTAMPTZ Migration** - Schema-Wide Improvement

**Changed:** All `TIMESTAMP` columns migrated to `TIMESTAMPTZ` (TIMESTAMP WITH TIME ZONE)

**Affected Columns (24 total):**

**Audit Trail Columns:**
- organizations, users, providers, sessions, affiliations, classrooms, teaching_assistants, challenges, challenge_solutions, knowledge_base: `created_at`, `updated_at`
- organizations, users, affiliations, classrooms, challenges: `deleted_at`
- user_classrooms: `deleted_at`

**Security-Critical Expiration Columns:**
- providers: `access_token_expires_at`, `refresh_token_expires_at`
- sessions: `expires_at`
- verifications: `expires_at`

**Event Timestamp Columns:**
- user_classrooms: `enrolled_at`
- work_sessions: `last_message_at`, `ended_at`
- conversation_replays: `replayed_at`
- user_interactions_on_challenges, replay_interactions: `created_at`

**Rationale:** Timezone-aware timestamps prevent critical issues in a multi-timezone, multi-organizational platform:
- **Security:** Session/token expiration times are unambiguous and work correctly across timezones
- **Data Integrity:** Audit trails (created_at, updated_at, deleted_at) have precise, unambiguous timestamps
- **DST Handling:** PostgreSQL automatically handles Daylight Saving Time transitions
- **Server Migration:** Moving servers across timezones doesn't corrupt timestamp data
- **User Experience:** Enrollment dates, message timestamps, and replay times display correctly for all users

**Technical Details:**
- Plain `TIMESTAMP` stores values without timezone context, leading to ambiguity
- `TIMESTAMPTZ` stores values in UTC internally and converts to local timezone on retrieval
- `DEFAULT now()` automatically returns timezone-aware timestamps when column type is TIMESTAMPTZ
- No application code changes needed; PostgreSQL handles conversion transparently

**Migration Impact:**
- **Fresh Deployments:** Apply updated schema.sql directly - no migration needed
- **Existing Databases:** Run `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ USING column_name AT TIME ZONE 'UTC'` for each column
- **Breaking Change:** Existing PostgreSQL databases require explicit migration script
- **Backward Compatibility:** Once migrated, all timestamp operations are timezone-aware

---

## Architecture Principles

### Multi-Tenancy & Multi-Organization Users
- Organizations → Classrooms → Challenges hierarchy supports multiple schools/institutions
- Users can belong to multiple organizations via affiliations
- Each affiliation has its own role (a user can be a teacher in one org, student in another)
- Standalone challenges (no classroom) are accessible by any organization

### Teaching Assistant Abstraction (Core Innovation)
- **Decoupling Model from Pedagogy**: Models table stores LLM capabilities; Teaching Assistants table stores pedagogical strategies
- **Versioned Prompt Engineering**: Each TA (alias + version) is immutable, enabling controlled evolution (Bob v1 → Bob v2 → Bob v3)
- **Flexible Assignment**: Challenges can have multiple TAs; students choose or are assigned based on skill level
- **A/B Testing Framework**: Conversation replays enable comparing TA effectiveness while keeping student behavior constant

### Separation of Concerns
- **Auth Sessions**: Login tokens, IP tracking, expiration
- **Work Sessions**: Challenge attempt tracking + TA selection
- **User Interactions**: Learning process (student-TA conversation)
- **Solutions**: Current work artifacts (code + chat snapshots)
- **Replays**: Counterfactual experiments (what-if analysis)

### Flexible Relationships
- Challenges can exist with or without classrooms (standalone practice)
- Challenges can have multiple TAs (beginner/advanced/experimental)
- Work sessions track classroom context and TA selection
- Knowledge base supports multiple scopes (org/classroom/challenge)

### Audit & Research
- Soft deletes preserve data integrity
- Interaction history enables learning analytics
- Solution snapshots show current state; interactions show evolution
- TA versioning ensures reproducibility
- Replay system enables pedagogical research and continuous improvement

---

## Data Flow Examples

### Student Solves a Challenge
1. **Opens challenge** → System fetches available TAs from `challenge_teaching_assistants`
2. **Selects TA** (or uses default) → Creates `work_session` with `teaching_assistant_id`
3. **Asks TA question** → Stores in `user_interactions_on_challenges`, updates `work_sessions.last_message_at`
4. **Runs code** → Updates interaction with stdin/stdout
5. **Saves work** → Updates `challenge_solutions` with latest code + chat_history snapshot
6. **Closes session** → Sets `work_sessions.ended_at`
7. **Reopens challenge later** → Loads from `challenge_solutions`, can switch to different TA

### Teacher Reviews Student Progress
1. **Queries `challenge_solutions`** → Sees final solution and cached chat history
2. **Queries `user_interactions_on_challenges`** → Analyzes full conversation history across all work sessions
3. **Queries `work_sessions`** → Identifies which TA was used, session duration, completion status
4. **Evaluates based on journey** → Reviews how student asked questions, iterated on solutions, engaged with TA

### Teacher Experiments with TAs (A/B Testing)
1. **Identifies struggling session** → Student had difficulty with Bob v1
2. **Creates replay** → INSERT into `conversation_replays` with Bob v2
3. **System replays conversation** → For each original student message, generates Bob v2 response
4. **Stores counterfactuals** → Saves in `replay_interactions` with links to original
5. **Compares side-by-side** → Joins original + replay to see if Bob v2 would have helped more
6. **Decides to promote** → If Bob v2 performs better, set `is_active = true` for Bob v2, `is_active = false` for Bob v1
7. **Future students** → Now use improved Bob v2 automatically

---

## Migration Notes

If migrating from initial schema:

### Phase 1: Multi-Organization Users & Auth
1. Expand `user_role` enum with coordinator and admin
2. Remove `organization_id` and `role` from `users` table
3. Create `affiliations` table (migrate existing user-org relationships)
4. Create `providers` table for OAuth
5. Create `sessions` table for auth tokens
6. Create `verifications` table

### Phase 2: Core Tables Restructuring
7. Rename `sessions` → `work_sessions`
8. Rename `llm_interactions` → `user_interactions_on_challenges`
9. Add `deleted_at` to `user_classrooms` (renamed from `user_classes`)
10. Rename `classrooms.class_id` → `classrooms.classroom_id` throughout schema

### Phase 3: Teaching Assistant System (CRITICAL)
11. Create `models` table and seed with available LLMs (Claude, GPT-4, etc.)
12. Create `teaching_assistants` table with versioning support
13. Create `challenge_teaching_assistants` join table
14. Remove `model_id` FK from `challenges` table
15. Add `teaching_assistant_id` FK to `work_sessions` table
16. Add `last_message_at` to `work_sessions` table
17. Migrate existing sessions: assign a default TA based on historical model usage

### Phase 4: Solutions & Interactions
18. Restructure `challenge_solutions`:
    - Remove `class_id` FK (redundant via challenge)
    - Remove `work_session_id` FK (current solution transcends work sessions)
    - Add `chat_history` (JSONB)
    - Add `code`, `stdin`, `stdout` (TEXT)
    - Add `UNIQUE (user_id, challenge_id)`
19. **Remove `challenge_solutions_history` table** (no longer needed; history tracked via `user_interactions_on_challenges`)
20. Enhance `challenges` with `title`, `support_materials`, `possible_solutions`, `deleted_at`

### Phase 5: A/B Testing Framework
21. Create `conversation_replays` table
22. Create `replay_interactions` table
23. Update `knowledge_base` with `challenge_id` FK

### Phase 6: Security & Performance Improvements (Code Review Fixes)
24. Make `users.password_hash` nullable to support OAuth-only users
25. Add HNSW vector index on `knowledge_base.embedding` for RAG performance
26. Add `ON DELETE CASCADE` to `conversation_replays.original_work_session_id`
27. Add `ON DELETE RESTRICT` to `conversation_replays.replay_teaching_assistant_id`
28. Add unique partial index on `challenge_teaching_assistants(challenge_id) WHERE is_default = true`
29. Reorder table definitions: move `challenge_teaching_assistants` after `challenges` table

### Phase 7: Timezone-Aware Timestamps
30. Migrate all `TIMESTAMP` columns to `TIMESTAMPTZ` (24 columns across 18 tables)
    - Audit trails: created_at, updated_at, deleted_at
    - Security-critical expirations: expires_at, access_token_expires_at, refresh_token_expires_at
    - Event timestamps: enrolled_at, last_message_at, ended_at, replayed_at
31. For existing databases, run: `ALTER TABLE table_name ALTER COLUMN column_name TYPE TIMESTAMPTZ USING column_name AT TIME ZONE 'UTC'`

### Post-Migration Tasks
- Seed `teaching_assistants` with initial TA configurations (e.g., Bob v1, Alice v1)
- Assign default TAs to existing challenges via `challenge_teaching_assistants`
- Run data quality checks: ensure all work_sessions have valid teaching_assistant_id
- Set up monitoring for TA usage patterns and student preferences
- Verify vector index is created successfully (can take time on large knowledge bases)
- Update application code to handle nullable password_hash for OAuth-only users
