-- General AI Premium pricing. All money in USD cents. Never spend historical Muapi funding.
ALTER TABLE realizo_ai_projects ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'sponsored'
  CHECK(billing_type IN ('sponsored','paid'));
ALTER TABLE realizo_ai_projects ADD COLUMN premium_price_cents INTEGER NOT NULL DEFAULT 0
  CHECK(premium_price_cents IN (0,49));
ALTER TABLE realizo_ai_projects ADD COLUMN research_fingerprint TEXT;
ALTER TABLE realizo_ai_projects ADD COLUMN pricing_version TEXT NOT NULL DEFAULT 'ai-premium-v1';

DROP TRIGGER IF EXISTS realizo_ai_one_daily_project;
-- Per-user and per-plan quota is enforced atomically even for concurrent
-- sessions. Sponsored grants are limited to one per day, paid to three.
CREATE TRIGGER IF NOT EXISTS realizo_ai_daily_quota_before_insert
BEFORE INSERT ON realizo_ai_projects
WHEN (
  (NEW.billing_type='sponsored' AND (
     SELECT COUNT(*) FROM realizo_ai_projects
     WHERE user_id=NEW.user_id AND created_at>=datetime('now','-1 day')
       AND billing_type='sponsored'
  )>=1)
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

-- Paid research uses its own settlement record but reserves in the existing
-- real-currency wallet. Never collect from sandbox PayPal fictitious funds.
CREATE TABLE IF NOT EXISTS realizo_ai_premium_orders (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL UNIQUE REFERENCES realizo_ai_projects(id),
 user_id TEXT NOT NULL REFERENCES wallet_users(id),
 price_cents INTEGER NOT NULL CHECK(price_cents=49),
 status TEXT NOT NULL DEFAULT 'reserved'
   CHECK(status IN ('reserved','captured','released')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS realizo_ai_premium_orders_user
 ON realizo_ai_premium_orders(user_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS realizo_ai_paid_reserve
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
  -- The original USD 7.75 was pre-funded at Muapi, not OpenAI. Lock it
  -- conservatively even if the user has since spent some on video.
  AND w.available_cents - COALESCE(
    (SELECT amount_cents FROM realizo_prepaid_muapi_imports
     WHERE user_id=NEW.user_id),0) >= NEW.price_cents
 );
END;

CREATE TRIGGER IF NOT EXISTS realizo_ai_paid_reserve_after_insert
AFTER INSERT ON realizo_ai_premium_orders
BEGIN
 UPDATE wallets SET available_cents=available_cents-NEW.price_cents,
 reserved_cents=reserved_cents+NEW.price_cents,updated_at=datetime('now')
 WHERE user_id=NEW.user_id;
 INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
 VALUES('ai-reserve:'||NEW.id,NEW.user_id,'reserve',-NEW.price_cents,NEW.price_cents,
 'ai-premium:'||NEW.id||':reserve');
END;

CREATE TRIGGER IF NOT EXISTS realizo_ai_settle_once
BEFORE UPDATE OF status ON realizo_ai_premium_orders
WHEN OLD.status IN ('captured','released') AND NEW.status<>OLD.status
BEGIN SELECT RAISE(ABORT,'ai_already_settled'); END;

CREATE TRIGGER IF NOT EXISTS realizo_ai_paid_capture
AFTER UPDATE OF status ON realizo_ai_premium_orders
WHEN NEW.status='captured' AND OLD.status='reserved'
BEGIN
 UPDATE wallets SET reserved_cents=reserved_cents-NEW.price_cents,updated_at=datetime('now')
 WHERE user_id=NEW.user_id;
 INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
 VALUES('ai-capture:'||NEW.id,NEW.user_id,'capture',0,-NEW.price_cents,
 'ai-premium:'||NEW.id||':capture');
END;

CREATE TRIGGER IF NOT EXISTS realizo_ai_paid_release
AFTER UPDATE OF status ON realizo_ai_premium_orders
WHEN NEW.status='released' AND OLD.status='reserved'
BEGIN
 UPDATE wallets SET available_cents=available_cents+NEW.price_cents,
 reserved_cents=reserved_cents-NEW.price_cents,updated_at=datetime('now')
 WHERE user_id=NEW.user_id;
 INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
 VALUES('ai-release:'||NEW.id,NEW.user_id,'release',NEW.price_cents,-NEW.price_cents,
 'ai-premium:'||NEW.id||':release');
END;
