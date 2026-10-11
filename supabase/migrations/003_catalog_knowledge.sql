-- Sulyap Lasalyano Artifacts + DLSU Presidents catalog expansions
-- Safe to re-run on Postgres/Supabase.

-- Rename accession column when migrating from rd_code
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'rd_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'id_code'
  ) THEN
    ALTER TABLE artifacts RENAME COLUMN rd_code TO id_code;
  END IF;
END $$;

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS id_code VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS year_acquired VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS artifact_type VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS president_id INTEGER REFERENCES presidents (id);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS llm_assist_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate year → year_acquired when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'year'
  ) THEN
    EXECUTE 'UPDATE artifacts SET year_acquired = year WHERE (year_acquired IS NULL OR year_acquired = '''') AND year IS NOT NULL AND year <> ''''';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_artifacts_id_code ON artifacts (id_code);
CREATE INDEX IF NOT EXISTS ix_artifacts_year_acquired ON artifacts (year_acquired);
CREATE INDEX IF NOT EXISTS ix_artifacts_country_of_origin ON artifacts (country_of_origin);
CREATE INDEX IF NOT EXISTS ix_artifacts_artifact_type ON artifacts (artifact_type);
CREATE INDEX IF NOT EXISTS ix_artifacts_president_id ON artifacts (president_id);

ALTER TABLE presidents ADD COLUMN IF NOT EXISTS biography TEXT NOT NULL DEFAULT '';
ALTER TABLE presidents ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE presidents ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  label VARCHAR(200) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'theme'
);

CREATE INDEX IF NOT EXISTS ix_tags_slug ON tags (slug);
CREATE INDEX IF NOT EXISTS ix_tags_kind ON tags (kind);

CREATE TABLE IF NOT EXISTS artifact_tags (
  artifact_id INTEGER NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  source VARCHAR(16) NOT NULL DEFAULT 'auto',
  PRIMARY KEY (artifact_id, tag_id, source)
);

CREATE INDEX IF NOT EXISTS ix_artifact_tags_artifact_id ON artifact_tags (artifact_id);
CREATE INDEX IF NOT EXISTS ix_artifact_tags_tag_id ON artifact_tags (tag_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_tags ENABLE ROW LEVEL SECURITY;
