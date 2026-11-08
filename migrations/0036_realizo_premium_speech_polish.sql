-- Internal copy-polishing cache for underwritten PREMIUM narrated projects.
-- The operator absorbs this corrective AI cost; customers are never billed.
-- One deterministic cache key per project and concept prevents duplicate calls.
CREATE TABLE IF NOT EXISTS realizo_ai_premium_speech_polish (
  project_id TEXT NOT NULL REFERENCES realizo_ai_projects(id),
  concept_index INTEGER NOT NULL CHECK(concept_index IN (0,1,2)),
  status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
  spoken_script TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(project_id,concept_index),
  CHECK (spoken_script IS NULL OR length(spoken_script) <= 3200)
);
CREATE INDEX IF NOT EXISTS realizo_ai_speech_polish_status ON
  realizo_ai_premium_speech_polish(status,updated_at);