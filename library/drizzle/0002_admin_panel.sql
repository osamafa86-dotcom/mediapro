ALTER TYPE "public"."role" ADD VALUE 'editor';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'contributor';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "expiry_reminder" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "allow_download" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "notify_first_download" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_links" ADD COLUMN "purpose" text DEFAULT 'login' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "title" text;--> statement-breakpoint
CREATE UNIQUE INDEX "links_code_uq" ON "links" USING btree ("code");