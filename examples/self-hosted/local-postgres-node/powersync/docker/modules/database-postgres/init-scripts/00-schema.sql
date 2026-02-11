-- Add your schema here: CREATE TABLE statements for tables referenced in sync.yaml.
-- This file runs before 01-powersync-publication.sql. The publication "powersync"
-- should include these tables (see 01-powersync-publication.sql).
--
-- Example:
CREATE TABLE IF NOT EXISTS todos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
