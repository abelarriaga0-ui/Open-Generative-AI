-- Realizo private reference media registry (R2 objects are not public).
CREATE TABLE IF NOT EXISTS realizo_media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 100 AND 10485760),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS realizo_media_by_owner ON realizo_media_assets(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS realizo_media_by_expiry ON realizo_media_assets(expires_at);
