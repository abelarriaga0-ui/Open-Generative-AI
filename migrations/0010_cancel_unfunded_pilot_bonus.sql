-- 0010_cancel_unfunded_pilot_bonus.sql
-- Cancel the one-time USD 0.35 internal test bonus. The USD 7.75 owner-funded
-- Muapi credit and the original grant/ledger audit entries are left intact.
-- Creating this schema does NOT change any balance.
CREATE TABLE IF NOT EXISTS realizo_pilot_grant_reversals (
  slot INTEGER PRIMARY KEY CHECK(slot = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES wallet_users(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents = 35),
  reason TEXT NOT NULL DEFAULT 'Cancel internal pilot bonus not backed by additional Muapi funds',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS realizo_pilot_grant_reversal_before_insert
BEFORE INSERT ON realizo_pilot_grant_reversals
BEGIN
  SELECT RAISE(ABORT, 'pilot_grant_owner_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM realizo_muapi_pilot_grants g
    JOIN wallet_users u ON u.id = g.user_id
    WHERE g.slot = 1 AND g.user_id = NEW.user_id
      AND g.amount_cents = 35 AND u.auth_provider = 'realizo'
  );
  SELECT RAISE(ABORT, 'prepaid_muapi_owner_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM realizo_prepaid_muapi_imports i
    WHERE i.slot = 1 AND i.user_id = NEW.user_id AND i.amount_cents = 775
  );
  SELECT RAISE(ABORT, 'wallet_balance_changed_manual_review_required')
  WHERE NOT EXISTS (
    SELECT 1 FROM wallets
    WHERE user_id = NEW.user_id
      AND available_cents = 810 AND reserved_cents = 0
  );
  SELECT RAISE(ABORT, 'wallet_ledger_inconsistent')
  WHERE NOT EXISTS (
    SELECT 1 FROM wallet_ledger
    WHERE user_id = NEW.user_id AND external_reference = 'pilot-credit:1'
      AND kind = 'deposit' AND available_delta_cents = 35 AND reserved_delta_cents = 0
  ) OR NOT EXISTS (
    SELECT 1 FROM wallet_ledger
    WHERE user_id = NEW.user_id AND external_reference = 'historical-muapi-prepaid:1'
      AND kind = 'deposit' AND available_delta_cents = 775 AND reserved_delta_cents = 0
  );
END;

CREATE TRIGGER IF NOT EXISTS realizo_pilot_grant_reversal_after_insert
AFTER INSERT ON realizo_pilot_grant_reversals
BEGIN
  UPDATE wallets
  SET available_cents = available_cents - 35,
      updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
  -- An offsetting negative deposit restores the ledger-to-balance invariant.
  -- Keep the original +35 entry as evidence of the initial pilot grant.
  INSERT INTO wallet_ledger
    (id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES
    ('pilot-reversal:' || NEW.slot, NEW.user_id, 'deposit', -35, 0,
     'pilot-bonus-reversed:' || NEW.slot);
END;
