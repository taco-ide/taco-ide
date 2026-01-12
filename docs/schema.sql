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
    role user_role NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX idx_users_organization_id ON users (organization_id);
-- =========================
-- CLASSES
-- =========================
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    subject TEXT,
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
    PRIMARY KEY (user_id, class_id),
    CONSTRAINT fk_user_classes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_classes_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
-- =========================
-- CHALLENGES
-- =========================
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    statement TEXT NOT NULL,
    created_by_user_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_challenges_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_challenges_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_challenges_class_id ON challenges (class_id);
-- =========================
-- SESSIONS
-- =========================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    class_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    last_message_at TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_sessions_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_sessions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_class_id ON sessions (class_id);
CREATE INDEX idx_sessions_challenge_id ON sessions (challenge_id);
-- =========================
-- CHALLENGE SOLUTIONS
-- =========================
CREATE TABLE challenge_solutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    solution TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_solutions_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_solutions_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    CONSTRAINT fk_solutions_session FOREIGN KEY (session_id) REFERENCES sessions(id),
    CONSTRAINT fk_solutions_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_solutions_user_id ON challenge_solutions (user_id);
CREATE INDEX idx_solutions_challenge_id ON challenge_solutions (challenge_id);
-- =========================
-- KNOWLEDGE BASE
-- =========================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    class_id UUID,
    created_by_user_id UUID,
    text TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_kb_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_kb_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_kb_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_kb_organization_id ON knowledge_base (organization_id);
CREATE INDEX idx_kb_class_id ON knowledge_base (class_id);
