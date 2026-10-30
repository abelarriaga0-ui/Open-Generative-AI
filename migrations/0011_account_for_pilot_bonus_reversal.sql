-- 0011_account_for_pilot_bonus_reversal.sql
-- Migration 0010 was applied to Sandbox before the audited offsetting
-- ledger entry was added. Replace ONLY its unexecuted reversal trigger.
-- Does NOT change any account balance or apply a reversal by itself.
DROP TRIGGER IF EXISTS realizo_pilot_grant_reversal_after_insert;

CREATE TRIGGER realizo_pilot_grant_reversal_after_insert
AFTER INSERT ON realizo_pilot_grant_reversals
BEGIN
  UPDATE wallets
  SET available_cents = available_cents - NEW.amount_cents,
      updated_at = datetime('now')
  WHERE user_id = NEW.user_id;

  -- Reverse the original +35 test credit, preserving the full audit chain.
  INSERT INTO wallet_ledger
    (id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES
    ('pilot-reversal:' || NEW.slot, NEW.user_id, 'deposit',
     -NEW.amount_cents, 0, 'pilot-credit:' || NEW.slot || ':reversed');
END;
