-- Paid REALIZO research is prepaid per request; a count-per-day limit
-- incorrectly blocks funded users after 3/5 projects (even when prior jobs
-- failed and were released). No daily/30-day cap applies to paid research.
-- Existing D1 wallet reservation, idempotency, verified funding, and
-- OpenAI-response billing logic remain unchanged.
-- Keep the historic sponsored (free) pilot quota only.
DROP TRIGGER IF EXISTS realizo_ai_one_daily_project;
DROP TRIGGER IF EXISTS realizo_ai_daily_quota_before_insert;

CREATE TRIGGER realizo_ai_daily_quota_before_insert
BEFORE INSERT ON realizo_ai_projects
WHEN NEW.billing_type='sponsored' AND (
  (SELECT COUNT(*) FROM realizo_ai_projects
    WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
      AND billing_type='sponsored')>=5
  OR
  (SELECT COUNT(*) FROM realizo_ai_projects
    WHERE billing_type='sponsored' AND created_at>=datetime('now','-1 day'))>=5
)
BEGIN
  SELECT RAISE(ABORT,'ai_premium_daily_limit');
END;
