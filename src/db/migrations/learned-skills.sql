-- Voyager-style learned skills library.
-- Stores skills that IntraClaw acquires from successful task executions.
-- Triple-storage: code + description + embedding (for semantic retrieval).
CREATE TABLE IF NOT EXISTS learned_skills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    UNIQUE NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  code          TEXT    NOT NULL,              -- TS function source OR tool-spec JSON
  description   TEXT    NOT NULL,              -- LLM-generated natural-language summary
  embedding     TEXT    NOT NULL,              -- JSON array of floats (for cosine similarity)
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  usage_count   INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_used_at  TEXT,
  tags          TEXT    NOT NULL DEFAULT '[]'  -- JSON array of string tags
);

CREATE INDEX IF NOT EXISTS idx_learned_skills_name  ON learned_skills(name);
CREATE INDEX IF NOT EXISTS idx_learned_skills_usage ON learned_skills(usage_count DESC);
