-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ENUMS
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'coordinator', 'admin');
-- Student is the lowest level, can only enroll and participate in classrooms.
-- Teacher can create and manage classrooms and challenges.
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

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_organizations_active ON organizations(id)
WHERE deleted_at IS NULL;

-- USERS
-- Soft delete is needed to keep history
-- password_hash is nullable to support OAuth-only users (no password authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    password_hash TEXT, -- NULL for OAuth-only users
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_users_email ON users (email)
WHERE deleted_at IS NULL;

-- AUTHENTICATION PROVIDERS
CREATE TABLE providers (
    user_id UUID NOT NULL,
    provider_name TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_providers PRIMARY KEY (user_id, provider_name),
    CONSTRAINT fk_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (provider_name, provider_user_id)
);

-- SESSIONS
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- VERIFICATION
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_verifications_identifier ON verifications(identifier);
CREATE INDEX idx_verifications_expires_at ON verifications(expires_at);

-- AFFILIATIONS (USERS-ORGANIZATIONS n-m RELATIONSHIP)
CREATE TABLE affiliations (
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT pk_affiliations PRIMARY KEY (organization_id, user_id),
    CONSTRAINT fk_affiliations_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_affiliations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_affiliations_active ON affiliations(organization_id, user_id)
WHERE deleted_at IS NULL;

-- CLASSROOMS
CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    subject TEXT,
    description TEXT,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_classrooms_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_classrooms_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_classrooms_organization_id ON classrooms (organization_id);
CREATE INDEX idx_classrooms_active ON classrooms(organization_id)
WHERE deleted_at IS NULL;

-- USER ↔ CLASSROOM (JOIN TABLE)
-- Soft delete preserves enrollment history
CREATE TABLE user_classrooms (
    user_id UUID NOT NULL,
    classroom_id UUID NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, classroom_id),
    CONSTRAINT fk_user_classrooms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_classrooms_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_classrooms_active ON user_classrooms(user_id, classroom_id)
WHERE deleted_at IS NULL;

-- MODELS (LLM Configurations)
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    model_parameters JSONB, -- Configuration: {"temperature": 0.7, "max_tokens": 2000, "top_p": 1.0}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- TEACHING ASSISTANTS (versioned TA configurations)
CREATE TABLE teaching_assistants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias VARCHAR(50) NOT NULL, -- 'Bob', 'Alice', etc.
    version INTEGER NOT NULL,
    model_id UUID NOT NULL,
    system_prompt TEXT NOT NULL,
    description TEXT, -- What changed in this version
    target_audience VARCHAR(50), -- 'beginner', 'advanced', etc.
    is_active BOOLEAN DEFAULT false,
    created_by_organization_id UUID, -- NULL = system-created TA (global), otherwise organization-specific
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(alias, version),
    CONSTRAINT fk_teaching_assistants_model FOREIGN KEY (model_id) REFERENCES models(id),
    CONSTRAINT fk_teaching_assistants_organization FOREIGN KEY (created_by_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX idx_teaching_assistants_alias ON teaching_assistants(alias);
CREATE INDEX idx_teaching_assistants_active ON teaching_assistants(alias, is_active)
WHERE is_active = true;
CREATE INDEX idx_teaching_assistants_organization ON teaching_assistants(created_by_organization_id);

-- CHALLENGES
-- If classroom_id is NULL, the challenge is standalone and accessible by any organization
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    support_materials JSONB,
    possible_solutions JSONB,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_challenges_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_challenges_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_challenges_classroom_id ON challenges (classroom_id);
CREATE INDEX idx_challenges_active ON challenges(classroom_id)
WHERE deleted_at IS NULL;

-- CHALLENGE ↔ TEACHING ASSISTANT (MANY-TO-MANY)
CREATE TABLE challenge_teaching_assistants (
    challenge_id UUID NOT NULL,
    teaching_assistant_id UUID NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (challenge_id, teaching_assistant_id),
    CONSTRAINT fk_challenge_tas_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_challenge_tas_ta FOREIGN KEY (teaching_assistant_id) REFERENCES teaching_assistants(id) ON DELETE CASCADE
);
CREATE INDEX idx_challenge_tas_challenge_id ON challenge_teaching_assistants(challenge_id);
CREATE INDEX idx_challenge_tas_ta_id ON challenge_teaching_assistants(teaching_assistant_id);
-- Ensure at most one default TA per challenge
CREATE UNIQUE INDEX idx_challenge_default_ta ON challenge_teaching_assistants(challenge_id) WHERE is_default = true;

-- WORK SESSIONS (user working on a challenge)
CREATE TABLE work_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    classroom_id UUID,
    challenge_id UUID NOT NULL,
    teaching_assistant_id UUID, -- For now, users can't change TA mid-session
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    CONSTRAINT fk_work_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_work_sessions_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_work_sessions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    CONSTRAINT fk_work_sessions_teaching_assistant FOREIGN KEY (teaching_assistant_id) REFERENCES teaching_assistants(id)
);
CREATE INDEX idx_work_sessions_user_id ON work_sessions (user_id);
CREATE INDEX idx_work_sessions_classroom_id ON work_sessions (classroom_id);
CREATE INDEX idx_work_sessions_challenge_id ON work_sessions (challenge_id);
CREATE INDEX idx_work_sessions_teaching_assistant ON work_sessions(teaching_assistant_id);

-- USER INTERACTIONS ON CHALLENGES (messages, prompts, responses, code runs, etc.)
CREATE TABLE user_interactions_on_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_session_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    user_prompt TEXT NOT NULL,
    model_response TEXT NOT NULL,
    code TEXT,
    stdin TEXT,
    stdout TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_interactions_work_session FOREIGN KEY (work_session_id) REFERENCES work_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_interactions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_interactions_work_session_id ON user_interactions_on_challenges (work_session_id);
CREATE INDEX idx_interactions_challenge_id ON user_interactions_on_challenges (challenge_id);

-- KNOWLEDGE BASE (RAG)
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    classroom_id UUID,
    challenge_id UUID,
    created_by_user_id UUID,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536), -- Need to match the embedding used in vector search
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_kb_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_kb_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_kb_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    CONSTRAINT fk_kb_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_kb_organization_id ON knowledge_base (organization_id);
CREATE INDEX idx_kb_classroom_id ON knowledge_base (classroom_id);
CREATE INDEX idx_kb_challenge_id ON knowledge_base (challenge_id);
-- Vector similarity search index for RAG queries
CREATE INDEX idx_kb_embedding ON knowledge_base USING hnsw (embedding vector_cosine_ops);

-- CONVERSATION REPLAYS (for A/B comparison)
CREATE TABLE conversation_replays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_work_session_id UUID NOT NULL,
    replay_teaching_assistant_id UUID NOT NULL,
    replayed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    UNIQUE(
        original_work_session_id,
        replay_teaching_assistant_id
    ),
    CONSTRAINT fk_replays_work_session FOREIGN KEY (original_work_session_id) REFERENCES work_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_replays_teaching_assistant FOREIGN KEY (replay_teaching_assistant_id) REFERENCES teaching_assistants(id) ON DELETE RESTRICT
);
CREATE INDEX idx_replays_work_session ON conversation_replays(original_work_session_id);
CREATE INDEX idx_replays_ta ON conversation_replays(replay_teaching_assistant_id);

-- REPLAYED INTERACTIONS (counterfactual responses)
CREATE TABLE replay_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    replay_id UUID NOT NULL,
    original_interaction_id UUID,
    user_prompt TEXT NOT NULL,
    model_response TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_replay_interactions_replay FOREIGN KEY (replay_id) REFERENCES conversation_replays(id) ON DELETE CASCADE,
    CONSTRAINT fk_replay_interactions_original FOREIGN KEY (original_interaction_id) REFERENCES user_interactions_on_challenges(id)
);
CREATE INDEX idx_replay_interactions_replay_id ON replay_interactions(replay_id);
CREATE INDEX idx_replay_interactions_original_id ON replay_interactions(original_interaction_id);
