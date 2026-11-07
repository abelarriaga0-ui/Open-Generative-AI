-- Public Muapi video catalog snapshot. Refreshed daily by a read-only
-- provider lookup in GitHub Actions and written directly to D1.
-- No user IDs, wallet balances, payment information or API credentials.
CREATE TABLE IF NOT EXISTS realizo_muapi_video_catalog (
  id TEXT PRIMARY KEY CHECK (id='active'),
  snapshot_json TEXT NOT NULL CHECK(length(snapshot_json)>2 AND length(snapshot_json)<350000),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);