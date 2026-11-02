-- 0009_prepaid_muapi_import.sql
-- Historical owner-funded Muapi money purchased BEFORE Realizo wallet/payments existed.
-- Schema only: zero credits are issued by applying this migration.
-- The privileged workflow must verify provider balance and native account identity
-- before inserting the one allowed historical import. NOT a PayPal payment.
CREATE TABLE IF NOT EXISTS realizo_prepaid_muapi_imports (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES wallet_users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents = 775),
  source TEXT NOT NULL DEFAULT 'Direct Muapi topup before Realizo wallets',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS realizo_prepaid_muapi_credit_after_insert
AFTER INSERT ON realizo_prepaid_muapi_imports
BEGIN
  SELECT RAISE(ABORT, 'owner_must_be_native_realizo')
  WHERE NOT EXISTS (
    SELECT 1 FROM wallet_users
    WHERE id = NEW.user_id AND auth_provider = 'realizo'
  );
  SELECT RAISE(ABORT, 'wallet_not_found')
  WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = NEW.user_id);
  UPDATE wallets
  SET available_cents = available_cents + NEW.amount_cents,
      updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
  INSERT INTO wallet_ledger
    (id, user_id, kind, available_delta_cents, reserved_delta_cents, external_reference)
  VALUES
    ('historical-muapi:' || NEW.slot, NEW.user_id,
     'deposit', NEW.amount_cents, 0,
     'historical-muapi-prepaid:' || NEW.slot);
END;
