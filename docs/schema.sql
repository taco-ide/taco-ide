-- =========================
-- Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE user_role AS ENUM ('student', 'teacher');

-- =========================
-- ORGANIZATIONS
-- =========================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP
);

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX idx_users_organization_id ON users (organization_id);
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- =========================
-- CLASSES
-- =========================
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

-- =========================
-- USER ↔ CLASS (JOIN TABLE)
-- =========================
CREATE TABLE user_classes (
    user_id UUID NOT NULL,
    class_id UUID NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, class_id),
    CONSTRAINT fk_user_classes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_classes_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- =========================
-- MODELS (LLM Configurations)
-- =========================
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- =========================
-- CHALLENGES
-- =========================
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

-- =========================
-- SESSIONS
-- =========================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    class_id UUID,
    challenge_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    last_message_at TIMESTAMP,
    ended_at TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_sessions_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_sessions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_class_id ON sessions (class_id);
CREATE INDEX idx_sessions_challenge_id ON sessions (challenge_id);

-- =========================
-- LLM INTERACTIONS
-- =========================
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
    CONSTRAINT fk_interactions_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_interactions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_interactions_session_id ON llm_interactions (session_id);
CREATE INDEX idx_interactions_user_id ON llm_interactions (user_id);
CREATE INDEX idx_interactions_challenge_id ON llm_interactions (challenge_id);

-- =========================
-- CHALLENGE SOLUTIONS (Current)
-- =========================
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

-- =========================
-- CHALLENGE SOLUTIONS HISTORY
-- =========================
CREATE TABLE challenge_solutions_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    solution TEXT NOT NULL,
    saved_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_solutions_history_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_solutions_history_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_solutions_history_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_solutions_history_session_id ON challenge_solutions_history (session_id);
CREATE INDEX idx_solutions_history_user_id ON challenge_solutions_history (user_id);
CREATE INDEX idx_solutions_history_challenge_id ON challenge_solutions_history (challenge_id);

-- =========================
-- KNOWLEDGE BASE (RAG)
-- =========================
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
