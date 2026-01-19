# Database Schema Changes

## Overview
Merged the initial schema draft with requirements from Issue #7 (taco-ide/dummy-ta#7) to create a comprehensive database architecture. Subsequently refactored to support multi-organization users, OAuth authentication, and expanded role hierarchy.

## Key Changes

### 1. **Users Table** - Refactored
**Added:**
- `email` (TEXT NOT NULL) - User authentication
- `password_hash` (TEXT NOT NULL) - Encrypted password storage
- Partial unique index on email (`WHERE deleted_at IS NULL`) - allows email reuse after soft-delete

**Removed:**
- `organization_id` - Users now belong to organizations via `affiliations` table
- `role` - Roles are now per-affiliation, not per-user

**Rationale:** Users can belong to multiple organizations with different roles in each. A teacher at one school can be a student at another.

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
- `access_token_expires_at`, `refresh_token_expires_at` (TIMESTAMP)
- `scope` (TEXT)
- Unique constraint on (provider_name, provider_user_id)

**Rationale:** Support OAuth login (Google, GitHub, etc.) alongside password authentication.

---

### 4. **Sessions Table** - NEW (Auth)
**Fields:**
- `id` (UUID PK)
- `user_id` (UUID FK → users)
- `expires_at` (TIMESTAMP NOT NULL)
- `token` (TEXT UNIQUE NOT NULL)
- `ip_address`, `user_agent` (TEXT)

**Rationale:** Auth session management with token-based authentication. Tracks login sessions separately from challenge work sessions.

---

### 5. **Verifications Table** - NEW
**Fields:**
- `id` (UUID PK)
- `identifier` (TEXT NOT NULL) - email or other identifier
- `value` (TEXT NOT NULL) - verification code/token
- `expires_at` (TIMESTAMP NOT NULL)

**Rationale:** Email verification, password reset, and other verification flows.

---

### 6. **User Role Enum** - Expanded
**Changed from:** `('student', 'teacher')`
**Changed to:** `('student', 'teacher', 'coordinator', 'admin')`

**Role hierarchy:** admin > coordinator > teacher > student
- **Student**: Enroll and participate in classes
- **Teacher**: Create and manage classes and challenges
- **Coordinator**: Manage users and roles within their organization
- **Admin**: Full system access, can create organizations

---

### 7. **Classes Table** - Enhanced
**Added:**
- `description` (TEXT) - Detailed class description

**Changed:**
- `class_id` now nullable in work_sessions (allows standalone challenges)

**Rationale:** Aligns with Issue #7 requirement to support challenges both within and outside of classes.

---

### 8. **User-Classes Join Table** - Enhanced
**Added:**
- `enrolled_at` (TIMESTAMP) - Track enrollment date
- `deleted_at` (TIMESTAMP) - Soft delete preserves enrollment history

**Rationale:** Useful for analytics and access control based on enrollment periods. Soft delete allows tracking when students unenrolled.

---

### 9. **Models Table** - NEW
**Fields:**
- `id` (UUID PK)
- `version` (TEXT NOT NULL)
- `name` (TEXT NOT NULL)
- `description` (TEXT)
- `created_at` (TIMESTAMP)
- Unique constraint on (name, version)

**Rationale:** From Issue #7 - track which LLM model/version is used for each challenge. Critical for reproducibility, cost tracking, and performance analysis.

---

### 10. **Challenges Table** - Significantly Enhanced
**Added:**
- `model_id` (UUID FK → models) - Which LLM to use
- `title` (TEXT NOT NULL) - Challenge title
- `support_materials` (JSONB) - Reference documents/materials
- `possible_solutions` (JSONB) - Teacher's reference implementations
- `deleted_at` (TIMESTAMP) - Soft delete support

**Changed:**
- `class_id` now nullable - standalone challenges are accessible by any organization

**Rationale:** Issue #7 requirements for teachers to provide reference materials and example solutions for better LLM context. Standalone challenges enable shared practice problems across organizations.

---

### 11. **Work Sessions Table** - Renamed & Enhanced
**Renamed from:** `sessions` → `work_sessions`

**Added:**
- `ended_at` (TIMESTAMP) - Track when session closed

**Changed:**
- `class_id` now nullable - aligns with standalone challenges

**Rationale:** Renamed to distinguish from auth sessions. Tracks a user's work session on a specific challenge.

---

### 12. **LLM Interactions Table** - NEW (CRITICAL)
**Fields:**
- `id` (UUID PK)
- `session_id` (UUID FK → work_sessions, CASCADE DELETE)
- `user_id` (UUID FK → users)
- `challenge_id` (UUID FK → challenges)
- `user_prompt` (TEXT NOT NULL) - Student's question
- `model_response` (TEXT NOT NULL) - LLM's answer
- `code` (TEXT) - Code snapshot at interaction time
- `stdin` (TEXT) - Input for code execution
- `stdout` (TEXT) - Output from code execution
- `created_at` (TIMESTAMP)

**Rationale:** THE CORE FEATURE - stores the entire student-LLM conversation history. Teachers evaluate learning progress by reviewing this interaction history, not test case results.

---

### 13. **Challenge Solutions Table** - Redesigned
**Changed:**
- Removed `class_id` FK (redundant via challenge)
- Removed `session_id` FK (current solution transcends sessions)
- Added `UNIQUE (user_id, challenge_id)` - One current solution per user per challenge

**Rationale:** Simplified to store ONLY the latest solution. Students reopen challenges and load their most recent work.

---

### 14. **Challenge Solutions History Table** - NEW
**Fields:**
- `id` (UUID PK)
- `session_id` (UUID FK → work_sessions, CASCADE DELETE)
- `user_id` (UUID FK → users)
- `challenge_id` (UUID FK → challenges)
- `solution` (TEXT NOT NULL)
- `saved_at` (TIMESTAMP)

**Rationale:** Append-only audit trail. Teachers can review solution evolution over time. Correlates with `llm_interactions` via `session_id` to understand learning progression.

---

### 15. **Knowledge Base Table** - Enhanced
**Added:**
- `challenge_id` (UUID FK → challenges) - Challenge-specific context

**Rationale:** Teachers can provide:
- Organization-level knowledge (general programming concepts)
- Class-level knowledge (course-specific materials)
- Challenge-level knowledge (specific problem context)

This enables precise RAG retrieval for LLM assistance.

---

## Architecture Principles

### Multi-Tenancy & Multi-Organization Users
- Organizations → Classes → Challenges hierarchy supports multiple schools/institutions
- Users can belong to multiple organizations via affiliations
- Each affiliation has its own role (a user can be a teacher in one org, student in another)
- Standalone challenges (no class) are accessible by any organization

### Separation of Concerns
- **Auth Sessions**: Login tokens, IP tracking, expiration
- **Work Sessions**: Challenge attempt tracking
- **LLM Interactions**: Learning process (conversation)
- **Solutions**: Work artifacts (code snapshots)
- **Solutions History**: Progress tracking (evolution)

### Flexible Relationships
- Challenges can exist with or without classes (standalone practice)
- Work sessions track class context when relevant
- Knowledge base supports multiple scopes (org/class/challenge)

### Audit & Research
- Soft deletes preserve data integrity
- Interaction history enables learning analytics
- Solution history shows skill development
- Model tracking ensures reproducibility

---

## Data Flow Example

**Student solves a challenge:**
1. Student opens challenge → Creates `work_session`
2. Asks LLM question → Stores in `llm_interactions`
3. Runs code → Updates interaction with stdin/stdout
4. Saves work → Updates `challenge_solutions` (current) + appends to `challenge_solutions_history`
5. Closes session → Sets `work_sessions.ended_at`

**Teacher reviews:**
1. Queries `challenge_solutions` → Sees final solution
2. Queries `challenge_solutions_history` → Reviews progression
3. Queries `llm_interactions` → Analyzes learning process
4. Evaluates based on journey, not just outcome

---

## Migration Notes

If migrating from initial schema:
1. Expand `user_role` enum with coordinator and admin
2. Remove `organization_id` and `role` from `users` table
3. Create `affiliations` table (migrate existing user-org relationships)
4. Create `providers` table for OAuth
5. Create `sessions` table for auth tokens
6. Create `verifications` table
7. Rename `sessions` → `work_sessions`
8. Add `deleted_at` to `user_classes`
9. Create `models` table and seed with available LLMs
10. Create `llm_interactions` table
11. Restructure `challenge_solutions` (remove redundant FKs, add unique constraint)
12. Create `challenge_solutions_history`
13. Enhance `challenges` with new fields
14. Update `knowledge_base` with challenge FK
