# Database Schema Changes

## Overview
Merged the initial schema draft with requirements from Issue #7 (taco-ide/dummy-ta#7) to create a comprehensive database architecture.

## Key Changes

### 1. **Users Table** - Enhanced
**Added:**
- `email` (TEXT NOT NULL) - User authentication
- `password_hash` (TEXT NOT NULL) - Encrypted password storage
- Unique index on email (excluding soft-deleted users)

**Rationale:** Issue #7 identified authentication fields as essential but were missing from initial draft.

---

### 2. **Classes Table** - Enhanced
**Added:**
- `description` (TEXT) - Detailed class description

**Changed:**
- `class_id` now nullable in sessions (allows standalone challenges)

**Rationale:** Aligns with Issue #7 requirement to support challenges both within and outside of classes.

---

### 3. **User-Classes Join Table** - Enhanced
**Added:**
- `enrolled_at` (TIMESTAMP) - Track enrollment date

**Rationale:** Useful for analytics and access control based on enrollment periods.

---

### 4. **Models Table** - NEW
**Fields:**
- `id` (UUID PK)
- `version` (TEXT NOT NULL)
- `name` (TEXT NOT NULL)
- `description` (TEXT)
- `created_at` (TIMESTAMP)
- Unique constraint on (name, version)

**Rationale:** From Issue #7 - track which LLM model/version is used for each challenge. Critical for reproducibility, cost tracking, and performance analysis.

---

### 5. **Challenges Table** - Significantly Enhanced
**Added:**
- `model_id` (UUID FK → models) - Which LLM to use
- `title` (TEXT NOT NULL) - Challenge title
- `support_materials` (JSONB) - Reference documents/materials
- `possible_solutions` (JSONB) - Teacher's reference implementations
- `deleted_at` (TIMESTAMP) - Soft delete support

**Changed:**
- `class_id` now nullable - supports standalone challenges
- Renamed `statement` field retained from original

**Rationale:** Issue #7 requirements for teachers to provide reference materials and example solutions for better LLM context.

---

### 6. **Sessions Table** - Enhanced
**Added:**
- `ended_at` (TIMESTAMP) - Track when session closed

**Changed:**
- `class_id` now nullable - aligns with standalone challenges

**Rationale:** Better session lifecycle tracking.

---

### 7. **LLM Interactions Table** - NEW (CRITICAL)
**Fields:**
- `id` (UUID PK)
- `session_id` (UUID FK → sessions, CASCADE DELETE)
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

### 8. **Challenge Solutions Table** - Redesigned
**Changed:**
- Removed `class_id` FK (redundant via challenge)
- Removed `session_id` FK (current solution transcends sessions)
- Added `UNIQUE (user_id, challenge_id)` - One current solution per user per challenge

**Rationale:** Simplified to store ONLY the latest solution. Students reopen challenges and load their most recent work.

---

### 9. **Challenge Solutions History Table** - NEW
**Fields:**
- `id` (UUID PK)
- `session_id` (UUID FK → sessions, CASCADE DELETE)
- `user_id` (UUID FK → users)
- `challenge_id` (UUID FK → challenges)
- `solution` (TEXT NOT NULL)
- `saved_at` (TIMESTAMP)

**Rationale:** Append-only audit trail. Teachers can review solution evolution over time. Correlates with `llm_interactions` via `session_id` to understand learning progression.

---

### 10. **Knowledge Base Table** - Enhanced
**Added:**
- `challenge_id` (UUID FK → challenges) - Challenge-specific context

**Rationale:** Teachers can provide:
- Organization-level knowledge (general programming concepts)
- Class-level knowledge (course-specific materials)
- Challenge-level knowledge (specific problem context)

This enables precise RAG retrieval for LLM assistance.

---

## Architecture Principles

### Multi-Tenancy
Organizations → Classes → Challenges hierarchy supports multiple schools/institutions in one deployment.

### Separation of Concerns
- **LLM Interactions**: Learning process (conversation)
- **Solutions**: Work artifacts (code snapshots)
- **Solutions History**: Progress tracking (evolution)

### Flexible Relationships
- Challenges can exist with or without classes (standalone practice)
- Sessions track class context when relevant
- Knowledge base supports multiple scopes (org/class/challenge)

### Audit & Research
- Soft deletes preserve data integrity
- Interaction history enables learning analytics
- Solution history shows skill development
- Model tracking ensures reproducibility

---

## Data Flow Example

**Student solves a challenge:**
1. Student opens challenge → Creates `session`
2. Asks LLM question → Stores in `llm_interactions`
3. Runs code → Updates interaction with stdin/stdout
4. Saves work → Updates `challenge_solutions` (current) + appends to `challenge_solutions_history`
5. Closes session → Sets `sessions.ended_at`

**Teacher reviews:**
1. Queries `challenge_solutions` → Sees final solution
2. Queries `challenge_solutions_history` → Reviews progression
3. Queries `llm_interactions` → Analyzes learning process
4. Evaluates based on journey, not just outcome

---

## Migration Notes

If migrating from initial schema:
1. Add authentication fields to `users`
2. Create `models` table and seed with available LLMs
3. Create `llm_interactions` table
4. Restructure `challenge_solutions` (remove redundant FKs, add unique constraint)
5. Create `challenge_solutions_history`
6. Enhance `challenges` with new fields
7. Update `knowledge_base` with challenge FK
