-- Explicitly limited to one provider-funded Muapi request in native Realizo Sandbox.
-- Remains consumed even if provider returns an ambiguous status: never retry blindly.
CREATE TABLE IF NOT EXISTS realizo_muapi_pilot_uses (
  slot INTEGER PRIMARY KEY CHECK(slot = 1),
  job_id TEXT NOT NULL UNIQUE REFERENCES generation_jobs(id),
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
