ALTER TABLE "user_interaction_on_challenge" ALTER COLUMN "user_prompt" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "user_interaction_on_challenge" ALTER COLUMN "model_response" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "difficulty" varchar(20);--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "user_interaction_on_challenge" ADD COLUMN "interaction_type" varchar(20) DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;