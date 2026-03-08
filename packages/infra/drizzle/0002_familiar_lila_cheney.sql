ALTER TABLE "knowledge_base" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "deleted_at" timestamp;