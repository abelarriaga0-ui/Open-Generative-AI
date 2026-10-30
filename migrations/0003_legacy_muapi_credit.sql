-- 0003_legacy_muapi_credit.sql
-- Explicit, audited opening credit for money loaded directly in Muapi BEFORE Realizo wallets existed.
-- This migration creates the mechanism only; it NEVER credits any user automatically.
-- Only a privileged operator can insert an import after checking the verified wallet user
-- and the actual provider balance. Not a PayPal payment or a new provider top-up.
CREATE TABLE IF NOT EXISTS legacy_muapi_credit_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES wallet_users(id),
  amount_cents INTEGER NOT NULL CHECK (typeof(amount_cents) = 'integer' AND amount_cents > 0),
  import_reference TEXT NOT NULL UNIQUE,
  note TEXT NOT NULL DEFAULT 'Saldo de Muapi comprado antes de Realizo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS legacy_muapi_credit_after_insert
AFTER INSERT ON legacy_muapi_credit_imports
BEGIN
  SELECT RAISE(ABORT, 'legacy_muapi_wallet_missing')
    WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = NEW.user_id);
  UPDATE wallets
  SET available_cents = available_cents + NEW.amount_cents, updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
  -- The pre-existing ledger schema uses 'deposit' for incoming value.
  -- The specific reference makes this distinguishable from any PayPal deposit.
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES
    ('legacy-muapi:' || NEW.id, NEW.user_id, 'deposit', NEW.amount_cents, 0,
     'legacy-muapi:' || NEW.import_reference);
END;
