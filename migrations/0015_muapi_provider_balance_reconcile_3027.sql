-- One-time USD 30.00 recognition of newly backed Muapi funds, bringing
-- the original verified Realizo owner from USD 0.27 to USD 30.27.
-- A privileged workflow independently verifies the live provider balance.
-- Never treat this as a PayPal capture or a free developer bonus.
CREATE TABLE IF NOT EXISTS realizo_muapi_provider_balance_reconciliations (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  user_id TEXT NOT NULL UNIQUE REFERENCES wallet_users(id),
  credited_cents INTEGER NOT NULL CHECK(credited_cents=3000),
  provider_verified_cents INTEGER NOT NULL CHECK(provider_verified_cents>=3027),
  wallet_before_cents INTEGER NOT NULL CHECK(wallet_before_cents=27),
  source TEXT NOT NULL DEFAULT 'Muapi real prepaid balance verified server to server',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS realizo_muapi_3027_credit_after_insert
AFTER INSERT ON realizo_muapi_provider_balance_reconciliations
BEGIN
  SELECT RAISE(ABORT,'muapi_3027_account_mismatch')
   WHERE NOT EXISTS(
     SELECT 1 FROM realizo_prepaid_muapi_imports original
     JOIN wallet_users u ON u.id=original.user_id
     JOIN wallets w ON w.user_id=u.id
     WHERE original.slot=1 AND original.user_id=NEW.user_id
       AND original.amount_cents=775 AND u.auth_provider='realizo'
       AND w.available_cents=NEW.wallet_before_cents
       AND w.reserved_cents=0
   );
  SELECT RAISE(ABORT,'muapi_3027_pending_jobs')
   WHERE EXISTS (SELECT 1 FROM generation_jobs WHERE status IN ('reserved','submitted','unknown'));
  SELECT RAISE(ABORT,'muapi_3027_other_wallet_liabilities')
   WHERE COALESCE((SELECT SUM(available_cents+reserved_cents) FROM wallets),0)<>27;
  SELECT RAISE(ABORT,'muapi_3027_paypal_not_real')
   WHERE EXISTS (SELECT 1 FROM verified_deposits);
  UPDATE wallets SET available_cents=available_cents+NEW.credited_cents,
      updated_at=datetime('now')
   WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
   VALUES('muapi-reconcile:3027:1',NEW.user_id,'deposit',NEW.credited_cents,0,'muapi-provider-reconciled:30.27:1');
END;
