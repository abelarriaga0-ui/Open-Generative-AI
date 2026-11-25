-- Atomic per-scope OTP quotas, independent of challenge replacement.
CREATE TABLE IF NOT EXISTS realizo_auth_rate_buckets (
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts > 0),
  PRIMARY KEY(scope,subject_hash,window_start)
);
CREATE INDEX IF NOT EXISTS realizo_auth_rate_buckets_expiry ON realizo_auth_rate_buckets(window_start);
