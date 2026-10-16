ALTER TABLE "challenge_reference_solution" ADD COLUMN "provider" varchar(16);--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "auto_review_provider" varchar(16);