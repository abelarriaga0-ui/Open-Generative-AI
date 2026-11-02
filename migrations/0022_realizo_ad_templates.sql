-- V11: store the selected REALIZO commercial template with each paid research.
-- Idempotent by migration tracking, no wallet or billing mutations.
ALTER TABLE realizo_ai_projects ADD COLUMN template_id TEXT;
ALTER TABLE realizo_ai_projects ADD COLUMN template_actor TEXT DEFAULT 'auto';
ALTER TABLE realizo_ai_projects ADD COLUMN template_setting TEXT DEFAULT 'auto';
CREATE INDEX IF NOT EXISTS realizo_ai_template_by_owner
 ON realizo_ai_projects(user_id,template_id,created_at);
