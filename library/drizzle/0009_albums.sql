CREATE TABLE "project_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_presets" (
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_presets_kind_value_pk" PRIMARY KEY("kind","value")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "album_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "album_id" uuid;--> statement-breakpoint
ALTER TABLE "project_albums" ADD CONSTRAINT "project_albums_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_albums" ADD CONSTRAINT "project_albums_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_presets" ADD CONSTRAINT "project_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "albums_project_idx" ON "project_albums" USING btree ("project_id","sort_order");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_album_id_project_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."project_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_album_id_project_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."project_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "project_presets" ("kind", "value", "created_by") SELECT DISTINCT ON (btrim("title")) 'title', btrim("title"), "created_by" FROM "projects" WHERE length(btrim("title")) >= 2 ORDER BY btrim("title"), "created_at" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "project_presets" ("kind", "value", "created_by") SELECT DISTINCT ON (btrim("type")) 'type', btrim("type"), "created_by" FROM "projects" WHERE length(btrim(coalesce("type", ''))) >= 1 ORDER BY btrim("type"), "created_at" ON CONFLICT DO NOTHING;
