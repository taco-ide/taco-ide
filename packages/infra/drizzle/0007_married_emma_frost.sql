CREATE TABLE "challenge_reference_solution" (
	"id" text PRIMARY KEY NOT NULL,
	"challenge_id" text NOT NULL,
	"kind" varchar(16) NOT NULL,
	"language" varchar(16) DEFAULT 'python' NOT NULL,
	"code" text,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" varchar(8) DEFAULT 'ai' NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission" DROP CONSTRAINT "submission_student_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "submission" ALTER COLUMN "student_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "auto_review_status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "submission" ADD COLUMN "auto_review_error" text;--> statement-breakpoint
ALTER TABLE "challenge_reference_solution" ADD CONSTRAINT "challenge_reference_solution_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_reference_solution_challenge_kind_uq" ON "challenge_reference_solution" USING btree ("challenge_id","kind");--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;