CREATE TABLE "knowledge_base_document" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"classroom_id" text,
	"challenge_id" text,
	"filename" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "document_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "chunk_index" integer;--> statement-breakpoint
ALTER TABLE "knowledge_base_document" ADD CONSTRAINT "knowledge_base_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_document" ADD CONSTRAINT "knowledge_base_document_classroom_id_classroom_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classroom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_document" ADD CONSTRAINT "knowledge_base_document_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_document_id_knowledge_base_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_base_document"("id") ON DELETE cascade ON UPDATE no action;