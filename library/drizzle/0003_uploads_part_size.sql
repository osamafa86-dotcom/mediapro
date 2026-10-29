ALTER TABLE "uploads" ADD COLUMN "part_size" integer DEFAULT 16777216 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "error" text;