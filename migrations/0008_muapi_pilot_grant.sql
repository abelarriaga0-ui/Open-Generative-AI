-- An auditable one-time 35-cent developer credit issued ONLY in a closed
-- Sandbox pilot after Muapi API key and isolated owner are verified.
-- This is not a PayPal deposit; first real topup still requires USD 20.
CREATE TABLE IF NOT EXISTS realizo_muapi_pilot_grants (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents=35),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS realizo_muapi_pilot_grant_credit
AFTER INSERT ON realizo_muapi_pilot_grants
BEGIN
  UPDATE wallets SET available_cents=available_cents+NEW.amount_cents,
    updated_at=datetime('now') WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger
    (id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES
    ('pilot-grant:'||NEW.slot,NEW.user_id,'deposit',NEW.amount_cents,0,
     'pilot-credit:'||NEW.slot);
END;
