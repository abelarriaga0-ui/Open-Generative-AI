-- Retain a clear, auditable debit instead of rewriting or deleting payment records.
-- The pre-existing wallet_ledger has a restrictive kind CHECK; rebuild it once
-- to add an explicit 'adjustment' kind and preserve all existing rows.
CREATE TABLE wallet_ledger_rebuilt (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  kind TEXT NOT NULL CHECK(kind IN ('deposit','reserve','capture','release','adjustment')),
  available_delta_cents INTEGER NOT NULL,
  reserved_delta_cents INTEGER NOT NULL,
  external_reference TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO wallet_ledger_rebuilt
(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference,created_at)
SELECT id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference,created_at FROM wallet_ledger;
DROP TABLE wallet_ledger;
ALTER TABLE wallet_ledger_rebuilt RENAME TO wallet_ledger;
CREATE INDEX wallet_ledger_by_user ON wallet_ledger(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_operator_adjustments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  before_cents INTEGER NOT NULL CHECK(before_cents >= 0),
  after_cents INTEGER NOT NULL CHECK(after_cents >= 0),
  reason TEXT NOT NULL CHECK(reason='operator_test_balance_cleanup'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(after_cents < before_cents)
);

CREATE TRIGGER wallet_operator_adjustment_guard
BEFORE INSERT ON wallet_operator_adjustments
BEGIN
  SELECT RAISE(ABORT,'operator_adjustment_not_owner')
  WHERE NOT EXISTS(
    SELECT 1 FROM wallet_users u JOIN realizo_accounts a ON a.id=u.auth_subject
    WHERE u.id=NEW.user_id AND u.auth_provider='realizo'
  );
  SELECT RAISE(ABORT,'operator_adjustment_balance_changed')
  WHERE NOT EXISTS(
    SELECT 1 FROM wallets w WHERE w.user_id=NEW.user_id
    AND w.available_cents=NEW.before_cents AND w.reserved_cents=0
  );
  SELECT RAISE(ABORT,'operator_adjustment_live_deposit_present')
  WHERE EXISTS(
    SELECT 1 FROM verified_deposits d
    WHERE d.user_id=NEW.user_id AND d.provider_environment='live'
  );
  SELECT RAISE(ABORT,'operator_adjustment_pending_job')
  WHERE EXISTS(
    SELECT 1 FROM generation_jobs g
    WHERE g.user_id=NEW.user_id AND g.status IN ('reserved','submitted','unknown')
  );
END;

CREATE TRIGGER wallet_operator_adjustment_apply
AFTER INSERT ON wallet_operator_adjustments
BEGIN
  UPDATE wallets SET available_cents=NEW.after_cents,updated_at=datetime('now')
  WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger
    (id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES
    ('operator:'||NEW.id,NEW.user_id,'adjustment',
     NEW.after_cents-NEW.before_cents,0,'operator-test-balance-cleanup:'||NEW.id);
END;
