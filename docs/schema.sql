-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ENUMS
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'coordinator', 'admin');
-- Student is the lowest level, can only enroll and participate in classes.
-- Teacher can create and manage classes and challenges.
-- Coordinator can manage which users are in their organization and their roles.
-- Admin has full access to all data and settings.  He/she can create organizations.
-- *
-- Roles are hierarchical: admin > coordinator > teacher > student

-- ORGANIZATIONS
-- Soft delete is needed to keep history
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,

    -- PLAN INFORMATION GOES HERE IN THE FUTURE
    -- AT THE MOMENT EVERYONE IS ON THE FREE PLAN

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP
);

-- USERS
-- Soft delete is needed to keep history
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- AUTHENTICATION PROVIDERS
CREATE TABLE providers (
    user_id UUID NOT NULL,
    provider_name TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMP,
    refresh_token_expires_at TIMESTAMP,
    scope TEXT,

    CONSTRAINT pk_providers PRIMARY KEY (user_id, provider_name),
    CONSTRAINT fk_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (provider_name, provider_user_id)
);

-- SESSIONS
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,

  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- VERIFICATION
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- AFFILIATIONS (USERS-ORGANIZATIONS n-m RELATIONSHIP)
CREATE TABLE affiliations (
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT pk_affiliations PRIMARY KEY (organization_id, user_id),
    CONSTRAINT fk_affiliations_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- CLASSES
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    subject TEXT,
    description TEXT,
    created_by_user_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_classes_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_classes_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_classes_organization_id ON classes (organization_id);

-- USER ↔ CLASS (JOIN TABLE)
-- Soft delete preserves enrollment history
CREATE TABLE user_classes (
    user_id UUID NOT NULL,
    class_id UUID NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    PRIMARY KEY (user_id, class_id),
    CONSTRAINT fk_user_classes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_classes_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- MODELS (LLM Configurations)
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- CHALLENGES
-- If class_id is NULL, the challenge is standalone and accessible by any organization
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID,
    model_id UUID NOT NULL,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    support_materials JSONB,
    possible_solutions JSONB,
    created_by_user_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_challenges_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_challenges_model FOREIGN KEY (model_id) REFERENCES models(id),
    CONSTRAINT fk_challenges_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_challenges_class_id ON challenges (class_id);
CREATE INDEX idx_challenges_model_id ON challenges (model_id);

-- WORK SESSIONS (user working on a challenge)
CREATE TABLE work_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    class_id UUID,
    challenge_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    last_message_at TIMESTAMP,
    ended_at TIMESTAMP,
    CONSTRAINT fk_work_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_work_sessions_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_work_sessions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_work_sessions_user_id ON work_sessions (user_id);
CREATE INDEX idx_work_sessions_class_id ON work_sessions (class_id);
CREATE INDEX idx_work_sessions_challenge_id ON work_sessions (challenge_id);

-- LLM INTERACTIONS
CREATE TABLE llm_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    user_prompt TEXT NOT NULL,
    model_response TEXT NOT NULL,
    code TEXT,
    stdin TEXT,
    stdout TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_interactions_work_session FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_interactions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_interactions_session_id ON llm_interactions (session_id);
CREATE INDEX idx_interactions_user_id ON llm_interactions (user_id);
CREATE INDEX idx_interactions_challenge_id ON llm_interactions (challenge_id);

-- CHALLENGE SOLUTIONS (Current)
CREATE TABLE challenge_solutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    solution TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_solutions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_solutions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    UNIQUE (user_id, challenge_id)
);
CREATE INDEX idx_solutions_user_id ON challenge_solutions (user_id);
CREATE INDEX idx_solutions_challenge_id ON challenge_solutions (challenge_id);

-- CHALLENGE SOLUTIONS HISTORY
CREATE TABLE challenge_solutions_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    solution TEXT NOT NULL,
    saved_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_solutions_history_work_session FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_solutions_history_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_solutions_history_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_solutions_history_session_id ON challenge_solutions_history (session_id);
CREATE INDEX idx_solutions_history_user_id ON challenge_solutions_history (user_id);
CREATE INDEX idx_solutions_history_challenge_id ON challenge_solutions_history (challenge_id);

-- KNOWLEDGE BASE (RAG)
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    class_id UUID,
    challenge_id UUID,
    created_by_user_id UUID,
    text TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_kb_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_kb_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_kb_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    CONSTRAINT fk_kb_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_kb_organization_id ON knowledge_base (organization_id);
CREATE INDEX idx_kb_class_id ON knowledge_base (class_id);
CREATE INDEX idx_kb_challenge_id ON knowledge_base (challenge_id);
