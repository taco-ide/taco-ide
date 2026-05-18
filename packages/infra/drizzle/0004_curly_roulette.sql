CREATE TABLE "teaching_assistant_evaluation" (
	"id" text PRIMARY KEY NOT NULL,
	"teaching_assistant_id" text NOT NULL,
	"grade" integer NOT NULL,
	"week" timestamp DEFAULT date_trunc('week', now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teaching_assistant_evaluation" ADD CONSTRAINT "teaching_assistant_evaluation_teaching_assistant_id_teaching_assistant_id_fk" FOREIGN KEY ("teaching_assistant_id") REFERENCES "public"."teaching_assistant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teaching_assistant_evaluation_ta_idx" ON "teaching_assistant_evaluation" USING btree ("teaching_assistant_id");