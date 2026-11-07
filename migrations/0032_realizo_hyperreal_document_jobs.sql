-- Isolated Hiperrealista PRO document extraction jobs (no wallet mutations).
-- The submitted document stays in-memory only for OpenAI submission; store
-- only extracted fields, status and provider response id. Charge no customer.
CREATE TABLE IF NOT EXISTS realizo_hyperreal_document_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  request_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting'
    CHECK(status IN ('starting','submitted','completed','failed')),
  provider_response_id TEXT,
  result_json TEXT,
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS realizo_hyperreal_document_jobs_owner
ON realizo_hyperreal_document_jobs(user_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_document_daily_limit
BEFORE INSERT ON realizo_hyperreal_document_jobs
WHEN (
  SELECT COUNT(*) FROM realizo_hyperreal_document_jobs
  WHERE user_id=NEW.user_id AND date(created_at)=date('now')
)>=3
BEGIN
  SELECT RAISE(ABORT,'hyperreal_document_daily_limit');
END;
