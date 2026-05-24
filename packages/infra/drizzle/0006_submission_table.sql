CREATE TABLE "submission" (
	"id" text PRIMARY KEY NOT NULL,
	"work_session_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"student_user_id" text,
	"code" text,
	"stdin" text,
	"stdout" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"grade" varchar(10),
	"grading_comment" text,
	"graded_by_user_id" text,
	"graded_at" timestamp,
	"auto_review" text,
	"auto_review_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_work_session_id_work_session_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_graded_by_user_id_user_id_fk" FOREIGN KEY ("graded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submission_work_session_idx" ON "submission" USING btree ("work_session_id");--> statement-breakpoint
CREATE INDEX "submission_challenge_idx" ON "submission" USING btree ("challenge_id");