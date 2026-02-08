CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"classroom_id" text,
	"title" text NOT NULL,
	"description" text,
	"support_materials" jsonb,
	"possible_solutions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "challenge_solution" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"chat_history" jsonb,
	"code" text,
	"stdin" text,
	"stdout" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_teaching_assistant" (
	"challenge_id" text NOT NULL,
	"teaching_assistant_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_teaching_assistant_challenge_id_teaching_assistant_id_pk" PRIMARY KEY("challenge_id","teaching_assistant_id")
);
--> statement-breakpoint
CREATE TABLE "classroom" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversation_replay" (
	"id" text PRIMARY KEY NOT NULL,
	"original_work_session_id" text NOT NULL,
	"replay_teaching_assistant_id" text NOT NULL,
	"replayed_at" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"classroom_id" text,
	"challenge_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"model_parameters" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"replay_id" text NOT NULL,
	"original_interaction_id" text NOT NULL,
	"user_prompt" text NOT NULL,
	"model_response" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_assistant" (
	"id" text PRIMARY KEY NOT NULL,
	"alias" varchar(50) NOT NULL,
	"version" integer NOT NULL,
	"model_id" text,
	"system_prompt" text NOT NULL,
	"description" text,
	"target_audience" varchar(50),
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_classroom" (
	"user_id" text NOT NULL,
	"classroom_id" text NOT NULL,
	"enrolled_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "user_classroom_user_id_classroom_id_pk" PRIMARY KEY("user_id","classroom_id")
);
--> statement-breakpoint
CREATE TABLE "user_interaction_on_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"work_session_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"user_prompt" text NOT NULL,
	"model_response" text NOT NULL,
	"code" text,
	"stdin" text,
	"stdout" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"classroom_id" text,
	"teaching_assistant_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_solution" ADD CONSTRAINT "challenge_solution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_solution" ADD CONSTRAINT "challenge_solution_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_teaching_assistant" ADD CONSTRAINT "challenge_teaching_assistant_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_teaching_assistant" ADD CONSTRAINT "challenge_teaching_assistant_teaching_assistant_id_teaching_assistant_id_fk" FOREIGN KEY ("teaching_assistant_id") REFERENCES "public"."teaching_assistant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_replay" ADD CONSTRAINT "conversation_replay_original_work_session_id_work_session_id_fk" FOREIGN KEY ("original_work_session_id") REFERENCES "public"."work_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_replay" ADD CONSTRAINT "conversation_replay_replay_teaching_assistant_id_teaching_assistant_id_fk" FOREIGN KEY ("replay_teaching_assistant_id") REFERENCES "public"."teaching_assistant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_interaction" ADD CONSTRAINT "replay_interaction_replay_id_conversation_replay_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."conversation_replay"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_interaction" ADD CONSTRAINT "replay_interaction_original_interaction_id_user_interaction_on_challenge_id_fk" FOREIGN KEY ("original_interaction_id") REFERENCES "public"."user_interaction_on_challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_assistant" ADD CONSTRAINT "teaching_assistant_model_id_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_assistant" ADD CONSTRAINT "teaching_assistant_created_by_organization_id_organization_id_fk" FOREIGN KEY ("created_by_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_classroom" ADD CONSTRAINT "user_classroom_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_classroom" ADD CONSTRAINT "user_classroom_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interaction_on_challenge" ADD CONSTRAINT "user_interaction_on_challenge_work_session_id_work_session_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interaction_on_challenge" ADD CONSTRAINT "user_interaction_on_challenge_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_session" ADD CONSTRAINT "work_session_teaching_assistant_id_teaching_assistant_id_fk" FOREIGN KEY ("teaching_assistant_id") REFERENCES "public"."teaching_assistant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_solution_user_challenge_idx" ON "challenge_solution" USING btree ("user_id","challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_replay_session_ta_idx" ON "conversation_replay" USING btree ("original_work_session_id","replay_teaching_assistant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_name_version_idx" ON "model" USING btree ("name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "teaching_assistant_alias_version_idx" ON "teaching_assistant" USING btree ("alias","version");