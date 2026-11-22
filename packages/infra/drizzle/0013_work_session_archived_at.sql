DROP INDEX "work_session_user_challenge_idx";--> statement-breakpoint
ALTER TABLE "work_session" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "work_session_user_challenge_idx" ON "work_session" USING btree ("user_id","challenge_id") WHERE archived_at IS NULL;