-- 0031_realizo_owner_muapi_balance_sync_20261107.sql
-- One-time operator allocation of VERIFIED remaining prepaid Muapi balance to
-- the ORIGINAL Realizo owner wallet. This is NOT PayPal revenue or a new payment.
-- Provider USD 30.892 has 3 decimals; wallets hold whole cents, so allocate
-- USD 30.89, NEVER over-allocate the USD 0.002 remainder.
-- Only a privileged workflow may use the INSERT after authenticating Muapi.
-- No existing ledger entries are edited or deleted.
CREATE TABLE IF NOT EXISTS realizo_owner_muapi_balance_sync_20261107 (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  before_cents INTEGER NOT NULL CHECK(before_cents=34),
  after_cents INTEGER NOT NULL CHECK(after_cents=3089),
  allocated_cents INTEGER NOT NULL CHECK(allocated_cents=3055),
  provider_verified_mills INTEGER NOT NULL CHECK(provider_verified_mills=30892),
  source TEXT NOT NULL DEFAULT 'Verified remaining prepaid Muapi balance; owner allocation 2026-11-07',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(after_cents=before_cents+allocated_cents),
  CHECK(after_cents=CAST(provider_verified_mills/10 AS INTEGER))
);
CREATE TRIGGER IF NOT EXISTS realizo_owner_muapi_balance_sync_guard_20261107
BEFORE INSERT ON realizo_owner_muapi_balance_sync_20261107
BEGIN
  SELECT RAISE(ABORT,'muapi_owner_sync_identity_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM realizo_prepaid_muapi_imports i
    JOIN realizo_muapi_provider_balance_reconciliations r
      ON r.user_id=i.user_id AND r.slot=1 AND r.credited_cents=3000
    JOIN wallet_users u ON u.id=i.user_id AND u.auth_provider='realizo'
    JOIN realizo_accounts a ON a.id=u.auth_subject
    WHERE i.slot=1 AND i.user_id=NEW.user_id AND i.amount_cents=775
  );
  SELECT RAISE(ABORT,'muapi_owner_sync_wallet_changed')
  WHERE NOT EXISTS (SELECT 1 FROM wallets w
    WHERE w.user_id=NEW.user_id AND w.available_cents=NEW.before_cents AND w.reserved_cents=0);
  SELECT RAISE(ABORT,'muapi_owner_sync_other_liabilities')
  WHERE EXISTS (SELECT 1 FROM wallets WHERE user_id<>NEW.user_id AND (available_cents>0 OR reserved_cents>0));
  SELECT RAISE(ABORT,'muapi_owner_sync_pending_videos')
  WHERE EXISTS (SELECT 1 FROM generation_jobs WHERE status IN ('reserved','submitted','unknown'));
  SELECT RAISE(ABORT,'muapi_owner_sync_pending_research')
  WHERE EXISTS (SELECT 1 FROM realizo_ai_premium_orders WHERE status='reserved');
  SELECT RAISE(ABORT,'muapi_owner_sync_other_live_deposits')
  WHERE EXISTS (SELECT 1 FROM verified_deposits WHERE user_id<>NEW.user_id AND provider_environment='live');
END;
CREATE TRIGGER IF NOT EXISTS realizo_owner_muapi_balance_sync_apply_20261107
AFTER INSERT ON realizo_owner_muapi_balance_sync_20261107
BEGIN
  UPDATE wallets
    SET available_cents=NEW.after_cents,updated_at=datetime('now')
    WHERE user_id=NEW.user_id AND available_cents=NEW.before_cents AND reserved_cents=0;
  INSERT INTO wallet_ledger
    (id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES
    ('realizo-owner-muapi-sync:20261107:1',NEW.user_id,'deposit',NEW.allocated_cents,0,
    'verified-direct-muapi-prepaid-owner-sync:20261107:1');
END;
