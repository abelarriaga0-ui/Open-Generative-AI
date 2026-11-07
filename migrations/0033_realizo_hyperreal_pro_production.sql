-- Hiperrealista PRO V2: isolated commercial multi-scene jobs.
-- No modifications to existing video generators, templates or PayPal.
CREATE TABLE IF NOT EXISTS realizo_hyperreal_pro_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quoted'
    CHECK(status IN ('quoted','reserved','processing','needs_review','completed','failed')),
  stage TEXT NOT NULL DEFAULT 'quote'
    CHECK(stage IN ('quote','research','image_master','scene_images','scene_videos','montage','completed','failed','needs_review')),
  product_asset_url TEXT NOT NULL,
  customer_brief_json TEXT NOT NULL CHECK(json_valid(customer_brief_json)),
  plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
  quote_breakdown_json TEXT NOT NULL CHECK(json_valid(quote_breakdown_json)),
  price_cents INTEGER NOT NULL CHECK(price_cents>0),
  quote_expires_at INTEGER NOT NULL,
  result_bytes INTEGER NOT NULL DEFAULT 0 CHECK(result_bytes>=0),
  result_sha256 TEXT,
  progress_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress_json)),
  failure_code TEXT,
  lease_owner TEXT,
  lease_expires_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS realizo_hyperreal_jobs_owner
  ON realizo_hyperreal_pro_jobs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS realizo_hyperreal_jobs_queue
  ON realizo_hyperreal_pro_jobs(status,lease_expires_at,updated_at);
CREATE TABLE IF NOT EXISTS realizo_hyperreal_pro_video_chunks (
  job_id TEXT NOT NULL REFERENCES realizo_hyperreal_pro_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK(chunk_index>=0),
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(job_id,chunk_index)
);
-- Confirming an exact, still-valid quote atomically reserves ONE wallet amount.
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_pro_reserve
AFTER UPDATE OF status ON realizo_hyperreal_pro_jobs
WHEN OLD.status='quoted' AND NEW.status='reserved'
BEGIN
  SELECT RAISE(ABORT,'hyperreal_quote_expired')
    WHERE NEW.quote_expires_at<=unixepoch();
  SELECT RAISE(ABORT,'hyperreal_insufficient_funds')
    WHERE NOT EXISTS(SELECT 1 FROM wallets
      WHERE user_id=NEW.user_id AND available_cents>=NEW.price_cents);
  UPDATE wallets SET available_cents=available_cents-NEW.price_cents,
    reserved_cents=reserved_cents+NEW.price_cents,updated_at=datetime('now')
    WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES('hyperreal-reserve:'||NEW.id,NEW.user_id,'reserve',-NEW.price_cents,NEW.price_cents,
    'hyperreal:'||NEW.id||':reserve');
END;
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_pro_capture
AFTER UPDATE OF status ON realizo_hyperreal_pro_jobs
WHEN NEW.status='completed' AND OLD.status IN ('reserved','processing','needs_review')
BEGIN
  SELECT RAISE(ABORT,'hyperreal_result_not_uploaded')
    WHERE NEW.result_bytes<10000 OR NEW.result_sha256 IS NULL OR
      NOT EXISTS(SELECT 1 FROM realizo_hyperreal_pro_video_chunks WHERE job_id=NEW.id);
  UPDATE wallets SET reserved_cents=reserved_cents-NEW.price_cents,
    updated_at=datetime('now') WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES('hyperreal-capture:'||NEW.id,NEW.user_id,'capture',0,-NEW.price_cents,
    'hyperreal:'||NEW.id||':capture');
END;
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_pro_release
AFTER UPDATE OF status ON realizo_hyperreal_pro_jobs
WHEN NEW.status='failed' AND OLD.status IN ('reserved','processing','needs_review')
BEGIN
  UPDATE wallets SET available_cents=available_cents+NEW.price_cents,
    reserved_cents=reserved_cents-NEW.price_cents,updated_at=datetime('now')
    WHERE user_id=NEW.user_id;
  INSERT INTO wallet_ledger(id,user_id,kind,available_delta_cents,reserved_delta_cents,external_reference)
  VALUES('hyperreal-release:'||NEW.id,NEW.user_id,'release',NEW.price_cents,-NEW.price_cents,
    'hyperreal:'||NEW.id||':release');
END;
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_pro_terminal_guard
BEFORE UPDATE OF status ON realizo_hyperreal_pro_jobs
WHEN OLD.status IN ('completed','failed') AND NEW.status<>OLD.status
BEGIN SELECT RAISE(ABORT,'hyperreal_job_already_settled'); END;
-- Quota: no more than three pending or actively rendering premium jobs per user.
CREATE TRIGGER IF NOT EXISTS realizo_hyperreal_pro_active_quota
BEFORE UPDATE OF status ON realizo_hyperreal_pro_jobs
WHEN OLD.status='quoted' AND NEW.status='reserved' AND
 (SELECT COUNT(*) FROM realizo_hyperreal_pro_jobs
  WHERE user_id=NEW.user_id AND status IN ('reserved','processing','needs_review'))>=3
BEGIN SELECT RAISE(ABORT,'hyperreal_active_job_limit'); END;
