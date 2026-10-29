ALTER TABLE "assets" ADD COLUMN "source_ref" text;--> statement-breakpoint
ALTER TABLE "drive_imports" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "drive_imports" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_source_uq" ON "assets" USING btree ("project_id","source_ref");