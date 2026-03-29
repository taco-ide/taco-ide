ALTER TABLE "classroom" ADD COLUMN "teacher_user_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunk" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_teacher_user_id_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;