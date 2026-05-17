-- F10 fix: downgrade any legacy auto-link rule that grants org "admin".
-- The signup auto-link path adds a `member` row using this `role` value,
-- which means anyone who created an account with an email matching the
-- domain would silently become a real organization admin. Cap legacy rows
-- at "teacher" — that role is enough to onboard teaching staff without
-- exposing destructive org-level actions (member delete, org settings).
--
-- New rules with role="admin" are blocked at the API layer
-- (see apps/api/src/http/routes/v1/organizations/email-domains/create.ts).
-- The auth hook also caps the effective role at "teacher" at runtime
-- (see packages/infra/src/auth/index.ts). This migration is the data
-- backfill so the three layers (API, runtime, data) stay in sync.

UPDATE "organization_email_domain"
SET "role" = 'teacher'
WHERE "role" = 'admin';
