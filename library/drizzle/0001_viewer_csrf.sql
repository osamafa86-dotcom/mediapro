ALTER TABLE "viewer_sessions" ADD COLUMN "csrf_token" text NOT NULL;--> statement-breakpoint
CREATE INDEX "viewer_sessions_link_idx" ON "viewer_sessions" USING btree ("link_id");