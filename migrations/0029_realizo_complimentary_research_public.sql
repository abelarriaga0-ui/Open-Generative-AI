-- Realizo may fund customer research temporarily. These are real provider
-- expenses borne by Realizo, never deposits or free Muapi video credits.
-- Keep per-user and global provider-cost protection for public traffic.
-- Paid research reservations remain unchanged when the feature is switched off.
DROP TRIGGER IF EXISTS realizo_ai_daily_quota_before_insert;
CREATE TRIGGER realizo_ai_daily_quota_before_insert
BEFORE INSERT ON realizo_ai_projects
WHEN NEW.billing_type='sponsored' AND (
 (SELECT COUNT(*) FROM realizo_ai_projects
    WHERE user_id=NEW.user_id AND billing_type='sponsored'
    AND created_at>=datetime('now','-1 day'))>=5
 OR
 (SELECT COUNT(*) FROM realizo_ai_projects
    WHERE billing_type='sponsored'
    AND created_at>=datetime('now','-1 day'))>=40
 OR
 (SELECT COUNT(*) FROM realizo_ai_projects
    WHERE billing_type='sponsored'
    AND created_at>=datetime('now','-30 days'))>=500
)
BEGIN
 SELECT RAISE(ABORT,'ai_premium_daily_limit');
END;

-- Historical Muapi prepaid balances remain auditable, but a verified owner is
-- selected by the SAME wallet user_id, never by an old USD 7.75 amount.
-- All other users keep the historical prepaid funding exclusion when/if
-- paid AI research is enabled again.
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
      SELECT 1 FROM realizo_muapi_provider_balance_reconciliations r
      WHERE r.slot=1 AND r.user_id=w.user_id
        AND r.provider_verified_cents>=r.credited_cents
     ) THEN 0
     ELSE COALESCE((SELECT amount_cents FROM realizo_prepaid_muapi_imports
                    WHERE user_id=w.user_id),0)
    END >= NEW.price_cents
 );
END;
