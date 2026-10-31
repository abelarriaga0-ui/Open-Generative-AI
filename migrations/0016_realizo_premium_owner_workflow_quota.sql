-- Keep AI research bounded while allowing several distinct product videos
-- in the verified owner Sandbox pilot. Public paid quotas stay unchanged.
DROP TRIGGER IF EXISTS realizo_ai_daily_quota_before_insert;
CREATE TRIGGER realizo_ai_daily_quota_before_insert
BEFORE INSERT ON realizo_ai_projects
WHEN (
  (NEW.billing_type='sponsored' AND (
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
        AND billing_type='sponsored')>=5
    OR
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='sponsored' AND created_at>=datetime('now','-1 day'))>=5
  ))
  OR
  (NEW.billing_type='paid' AND (
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
        AND billing_type='paid')>=3
    OR
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='paid' AND created_at>=datetime('now','-1 day'))>=40
    OR
    (SELECT COUNT(*) FROM realizo_ai_projects
      WHERE billing_type='paid' AND created_at>=datetime('now','-30 days'))>=500
  ))
)
BEGIN SELECT RAISE(ABORT,'ai_premium_daily_limit'); END;
