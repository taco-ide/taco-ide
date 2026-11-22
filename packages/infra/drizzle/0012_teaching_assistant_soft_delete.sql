DROP INDEX "teaching_assistant_alias_version_idx";--> statement-breakpoint
ALTER TABLE "teaching_assistant" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teaching_assistant" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "teaching_assistant_org_alias_version_idx" ON "teaching_assistant" USING btree ("created_by_organization_id","alias","version") WHERE "teaching_assistant"."deleted_at" is null;