-- Private, reusable creative templates; no wallet or payment writes.
CREATE TABLE IF NOT EXISTS realizo_user_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('ugc','cine_premium','demostracion','comercial','otros')),
  description TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  duration_seconds INTEGER,
  workflow_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS realizo_user_templates_owner
  ON realizo_user_templates(user_id,created_at DESC);
-- Keep safe, client-independent prompt and mode metadata from future jobs.
-- No product media URLs, API keys or card data are stored in this column.
ALTER TABLE generation_jobs ADD COLUMN template_source_json TEXT;
