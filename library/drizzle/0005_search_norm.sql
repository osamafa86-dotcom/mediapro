-- Search normalization (docs/decisions/0003). Twin of normalizeSearch() in src/lib/format.ts — keep identical.
--  · Turkish-aware lower case: İ → i (the combining dot is dropped below), ı → i
--  · Arabic: hamza forms → ا, ى → ي, ة → ه; harakat, tatweel and the superscript alef removed
--  · the article: ال / وال / بال / لل dropped from the start of a word when 2+ letters remain («الزفاف» = «زفاف»)
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE OR REPLACE FUNCTION ml_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      regexp_replace(translate(lower(t), 'أإآٱىةı', 'اااايهi'), '[ـً-ْٰ̇]', '', 'g'),
      '(^|[^ء-ي])(وال|بال|لل|ال)([ء-ي]{2,})', '\1\3', 'g'),
    '\s+', ' ', 'g'))
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS projects_title_trgm ON projects USING gin (ml_norm(title) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assets_name_trgm ON assets USING gin (ml_norm(original_name) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS clients_name_trgm ON clients USING gin (ml_norm(name_ar || ' ' || coalesce(name_tr, '')) gin_trgm_ops);
