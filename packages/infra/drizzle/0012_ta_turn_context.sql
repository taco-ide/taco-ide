CREATE TABLE "ta_turn_context" (
	"interaction_id" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"app_version" text,
	"teaching_assistant_id" text NOT NULL,
	"system_prompt" text NOT NULL,
	"prompt_context" jsonb NOT NULL,
	"challenge" jsonb NOT NULL,
	"history_interaction_ids" jsonb NOT NULL,
	"retrieval" jsonb NOT NULL,
	"llm" jsonb NOT NULL,
	"trajectory" jsonb NOT NULL,
	"langfuse_trace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ta_turn_context" ADD CONSTRAINT "ta_turn_context_interaction_id_user_interaction_on_challenge_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."user_interaction_on_challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ta_turn_context" ADD CONSTRAINT "ta_turn_context_teaching_assistant_id_teaching_assistant_id_fk" FOREIGN KEY ("teaching_assistant_id") REFERENCES "public"."teaching_assistant"("id") ON DELETE no action ON UPDATE no action;