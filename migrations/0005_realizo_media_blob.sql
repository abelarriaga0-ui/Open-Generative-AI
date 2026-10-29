-- Temporary, size-limited image blobs for the isolated Sandbox while private R2
-- permissions are pending. R2 remains the preferred production storage layer.
CREATE TABLE IF NOT EXISTS realizo_media_binary_sandbox (
  asset_id TEXT PRIMARY KEY REFERENCES realizo_media_assets(id) ON DELETE CASCADE,
  body BLOB NOT NULL CHECK(length(body) BETWEEN 100 AND 900000)
);
