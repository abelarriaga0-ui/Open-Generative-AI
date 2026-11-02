-- REALIZO sandbox pilot: use one shared, actually available wallet balance for
-- both video and AI research, BUT only for the uniquely verified owner account.
-- The existing 775-cent exclusion made the displayed wallet balance differ
-- from spendable AI funds. No credits are created by this migration.
--
-- For everyone else, the historic Muapi-prepaid exclusion remains intact.
-- Real/production customer identity, deposit verification, one-time reservation,
-- idempotency, capture and refund triggers are unchanged.
DROP TRIGGER IF EXISTS realizo_ai_paid_reserve;
CREATE TRIGGER realizo_ai_paid_reserve
BEFORE INSERT ON realizo_ai_premium_orders
BEGIN
 SELECT RAISE(ABORT,'ai_invalid_paid_project')
 WHERE NOT EXISTS(
  SELECT 1 FROM realizo_ai_projects p
  WHERE p.id=NEW.project_id AND p.user_id=NEW.user_id
    AND p.billing_type='paid' AND p.premium_price_cents=NEW.price_cents
 );
 SELECT RAISE(ABORT,'ai_insufficient_general_funds')
 WHERE NOT EXISTS (
  SELECT 1 FROM wallets w WHERE w.user_id=NEW.user_id
   AND w.available_cents -
    CASE
      WHEN EXISTS (
       SELECT 1 FROM realizo_muapi_provider_balance_reconciliations v
       JOIN realizo_prepaid_muapi_imports i ON i.user_id=v.user_id AND i.slot=1
       WHERE v.slot=1 AND v.user_id=w.user_id AND v.credited_cents=3000
         AND v.provider_verified_cents>=3027 AND i.amount_cents=775
      )
      THEN 0
      ELSE COALESCE((SELECT amount_cents FROM realizo_prepaid_muapi_imports
                     WHERE user_id=w.user_id),0)
    END >= NEW.price_cents
 );
END;
