ALTER TABLE "challenge" ADD COLUMN "release_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "late_policy" varchar(16) DEFAULT 'allow_late' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_schedule_window_check" CHECK ("challenge"."due_at" IS NULL OR "challenge"."release_at" IS NULL OR "challenge"."due_at" > "challenge"."release_at");--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_late_policy_check" CHECK ("challenge"."late_policy" IN ('allow_late', 'block'));