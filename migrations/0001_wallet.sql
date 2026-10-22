-- 0001_wallet.sql
-- One platform Muapi account, one independent USD wallet per authenticated customer.
-- Currency is stored in integer USD cents. No floating-point money arithmetic.
-- Cloudflare D1 automatically enforces foreign keys; no PRAGMA toggle is needed.

CREATE TABLE IF NOT EXISTS wallet_users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  email TEXT,
  country_code TEXT CHECK(country_code IS NULL OR (length(country_code) = 2 AND country_code = upper(country_code))),
  preferred_locale TEXT NOT NULL DEFAULT 'es',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(auth_provider, auth_subject)
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY REFERENCES wallet_users(id),
  available_cents INTEGER NOT NULL DEFAULT 0 CHECK(available_cents >= 0),
  reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK(reserved_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_prices (
  model_id TEXT PRIMARY KEY,
  muapi_endpoint TEXT NOT NULL,
  customer_price_cents INTEGER NOT NULL CHECK(customer_price_cents > 0),
  allowed_input_keys_json TEXT NOT NULL DEFAULT '["prompt"]' CHECK(json_valid(allowed_input_keys_json)),
  fixed_options_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fixed_options_json)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  model_id TEXT NOT NULL REFERENCES model_prices(model_id),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK(status IN ('reserved', 'submitted', 'unknown', 'completed', 'failed')),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  provider_request_id TEXT UNIQUE,
  result_json TEXT,
  error_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS verified_deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  payment_provider TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  -- Original checkout amount, currency and country are informational/auditable.
  -- The credit is ALWAYS the USD value of service credits that was sold.
  charged_currency TEXT CHECK(charged_currency IS NULL OR length(charged_currency) = 3),
  charged_amount_minor INTEGER CHECK(charged_amount_minor IS NULL OR charged_amount_minor > 0),
  checkout_country TEXT CHECK(checkout_country IS NULL OR length(checkout_country) = 2),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status = 'paid'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payment_provider, payment_reference)
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  kind TEXT NOT NULL CHECK(kind IN ('deposit', 'reserve', 'capture', 'release')),
  available_delta_cents INTEGER NOT NULL,
  reserved_delta_cents INTEGER NOT NULL,
  external_reference TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wallet_ledger_by_user ON wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_jobs_by_user ON generation_jobs(user_id, created_at DESC);

-- Reservation and debit happen in a single SQLite statement/trigger; no client balance value trusted.
CREATE TRIGGER IF NOT EXISTS generation_reserve_after_insert
AFTER INSERT ON generation_jobs
BEGIN
  SELECT RAISE(ABORT, 'wallet_insufficient_funds')
    WHERE NOT EXISTS (
      SELECT 1 FROM wallets
      WHERE user_id = NEW.user_id AND available_cents >= NEW.price_cents
    );
  UPDATE wallets SET
    available_cents = available_cents - NEW.price_cents,
    reserved_cents = reserved_cents + NEW.price_cents,
    updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES
    ('reserve:' || NEW.id, NEW.user_id, 'reserve', -NEW.price_cents,
     NEW.price_cents, 'generation:' || NEW.id || ':reserve');
END;

CREATE TRIGGER IF NOT EXISTS generation_capture_after_success
AFTER UPDATE OF status ON generation_jobs
WHEN NEW.status = 'completed' AND OLD.status IN ('reserved', 'submitted', 'unknown')
BEGIN
  UPDATE wallets SET reserved_cents = reserved_cents - NEW.price_cents,
    updated_at = datetime('now') WHERE user_id = NEW.user_id;
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES ('capture:' || NEW.id, NEW.user_id, 'capture', 0, -NEW.price_cents,
    'generation:' || NEW.id || ':capture');
END;

CREATE TRIGGER IF NOT EXISTS generation_release_after_failure
AFTER UPDATE OF status ON generation_jobs
WHEN NEW.status = 'failed' AND OLD.status IN ('reserved', 'submitted', 'unknown')
BEGIN
  UPDATE wallets SET available_cents = available_cents + NEW.price_cents,
    reserved_cents = reserved_cents - NEW.price_cents,
    updated_at = datetime('now') WHERE user_id = NEW.user_id;
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES ('release:' || NEW.id, NEW.user_id, 'release', NEW.price_cents,
    -NEW.price_cents, 'generation:' || NEW.id || ':release');
END;

-- First verified top-up must be at least USD 20; later top-ups may be any positive amount.
CREATE TRIGGER IF NOT EXISTS first_deposit_minimum_before_insert
BEFORE INSERT ON verified_deposits
WHEN NEW.amount_cents < 2000 AND NOT EXISTS (
  SELECT 1 FROM verified_deposits WHERE user_id=NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'first_topup_minimum_20_usd');
END;

-- Insert here ONLY after server-to-server payment webhook verification.
-- A duplicate provider payment event has no second credit because of its UNIQUE key.
CREATE TRIGGER IF NOT EXISTS wallet_credit_after_verified_deposit
AFTER INSERT ON verified_deposits
BEGIN
  UPDATE wallets SET available_cents = available_cents + NEW.amount_cents,
    updated_at = datetime('now') WHERE user_id = NEW.user_id;
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES ('deposit:' || NEW.id, NEW.user_id, 'deposit', NEW.amount_cents, 0,
    'payment:' || NEW.payment_provider || ':' || NEW.payment_reference);
END;

-- Guard terminal job transitions, avoid accidental double settlement.
CREATE TRIGGER IF NOT EXISTS generation_prevent_terminal_status_change
BEFORE UPDATE OF status ON generation_jobs
WHEN OLD.status IN ('completed','failed') AND NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'generation_already_settled');
END;
