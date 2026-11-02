-- Freeze model and duration before incurring research costs.
-- Existing projects retain their historical 8-second fallback.
ALTER TABLE realizo_ai_projects ADD COLUMN video_model_id TEXT NOT NULL DEFAULT 'seedance-2.5-omni-reference';
ALTER TABLE realizo_ai_projects ADD COLUMN video_duration_seconds INTEGER NOT NULL DEFAULT 8
 CHECK(video_duration_seconds BETWEEN 1 AND 120);
ALTER TABLE realizo_ai_projects ADD COLUMN video_workflow_id TEXT;

-- Audit one OpenAI response using provider usage, without changing customer pricing.
-- Estimates do not equal the final provider invoice and are never collected as exact charges.
ALTER TABLE realizo_ai_usage ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realizo_ai_usage ADD COLUMN estimated_cost_micro_usd INTEGER;
ALTER TABLE realizo_ai_usage ADD COLUMN cost_status TEXT NOT NULL DEFAULT 'unavailable'
 CHECK(cost_status IN ('estimated','unavailable'));
ALTER TABLE realizo_ai_usage ADD COLUMN cost_pricing_snapshot TEXT;
