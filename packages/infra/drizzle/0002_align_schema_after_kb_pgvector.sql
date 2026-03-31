CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "challenge_knowledge_base" (
	"challenge_id" text NOT NULL,
	"knowledge_base_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_knowledge_base_challenge_id_knowledge_base_id_pk" PRIMARY KEY("challenge_id","knowledge_base_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text,
	"knowledge_base_id" text,
	"chunk_index" integer,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_document" (
	"id" text PRIMARY KEY NOT NULL,
	"knowledge_base_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'uploading' NOT NULL,
	"error_message" text,
	"error_stage" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP CONSTRAINT "knowledge_base_challenge_id_challenge_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP CONSTRAINT "knowledge_base_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP CONSTRAINT "knowledge_base_classroom_id_classroom_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "classroom_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "teacher_user_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "challenge_knowledge_base" ADD CONSTRAINT "challenge_knowledge_base_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_knowledge_base" ADD CONSTRAINT "challenge_knowledge_base_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunk" ADD CONSTRAINT "knowledge_base_chunk_document_id_knowledge_base_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_base_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_chunk" ADD CONSTRAINT "knowledge_base_chunk_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_document" ADD CONSTRAINT "knowledge_base_document_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_embedding_idx" ON "knowledge_base_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_teacher_user_id_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN "challenge_id";--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN "content";