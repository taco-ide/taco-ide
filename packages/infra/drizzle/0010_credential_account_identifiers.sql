-- Better Auth credential account identifiers must match the owning user id.
-- Preserve identities, password hashes, timestamps, and non-credential providers.
-- This sequence extends main at 0009. Coordinate journal numbering with PRs #110
-- and #112 (both introduce 0010); rebase/renumber before combining migrations.
DO $migration$
BEGIN
  LOCK TABLE "account" IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT "user_id"
    FROM "account"
    WHERE "provider_id" = 'credential'
    GROUP BY "user_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ambiguous credential accounts: multiple credentials for one user; resolve duplicates before retrying normalization';
  END IF;

  UPDATE "account"
  SET "account_id" = "user_id"
  WHERE "provider_id" = 'credential'
    AND "account_id" <> "user_id";
END
$migration$;
