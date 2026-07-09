ALTER TABLE "challenge" ADD COLUMN "release_at" timestamp;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "late_policy" varchar(16) DEFAULT 'allow_late' NOT NULL;