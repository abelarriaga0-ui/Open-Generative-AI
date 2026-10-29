-- 0003_realizo_identity.sql
-- First-party identity for Realizo; deliberately isolated from Cloudflare Access users.
-- Uses cloud-based D1 with only verified email or Google identities.
CREATE TABLE IF NOT EXISTS realizo_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS realizo_identities (
  provider TEXT NOT NULL CHECK(provider IN ('email','google')),
  provider_subject TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES realizo_accounts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(provider, provider_subject)
);
CREATE INDEX IF NOT EXISTS realizo_identities_by_account ON realizo_identities(account_id);
CREATE TABLE IF NOT EXISTS realizo_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES realizo_accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS realizo_sessions_by_account ON realizo_sessions(account_id,expires_at);
CREATE TABLE IF NOT EXISTS realizo_email_challenges (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  sent_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS realizo_email_challenges_ip ON realizo_email_challenges(ip_hash,sent_at);
CREATE TABLE IF NOT EXISTS realizo_oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS realizo_oauth_states_expiry ON realizo_oauth_states(expires_at);
