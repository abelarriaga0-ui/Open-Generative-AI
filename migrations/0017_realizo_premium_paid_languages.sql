-- Explicit video/dialogue language. Historical research stays Spanish.
-- The price charged for each new research remains fixed at USD 0.49,
-- captured only after three valid concepts. No historical sponsored
-- research is retroactively charged.
ALTER TABLE realizo_ai_projects ADD COLUMN video_language TEXT NOT NULL DEFAULT 'es'
  CHECK(video_language IN ('es','en','pt','fr','de','it'));

-- Verified pilot owner can research up to five paid projects per day.
-- Everyone else keeps the existing 3/day paid, 40/day global, 500/month.
DROP TRIGGER IF EXISTS realizo_ai_daily_quota_before_insert;
CREATE TRIGGER realizo_ai_daily_quota_before_insert
BEFORE INSERT ON realizo_ai_projects
WHEN (
  (NEW.billing_type='sponsored' AND (
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
        AND billing_type='sponsored')>=5
    OR (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='sponsored' AND created_at>=datetime('now','-1 day'))>=5
  ))
  OR (NEW.billing_type='paid' AND (
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
        AND billing_type='paid') >=
      (CASE WHEN EXISTS(
        SELECT 1 FROM realizo_muapi_provider_balance_reconciliations r
         WHERE r.slot=1 AND r.user_id=NEW.user_id AND r.credited_cents=3000
      ) THEN 5 ELSE 3 END)
    OR (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='paid' AND created_at>=datetime('now','-1 day'))>=40
    OR (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='paid' AND created_at>=datetime('now','-30 days'))>=500
  ))
)
BEGIN SELECT RAISE(ABORT,'ai_premium_daily_limit'); END;
