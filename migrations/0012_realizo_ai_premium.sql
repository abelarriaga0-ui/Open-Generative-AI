-- AI Premium beta: isolated research, approval, traceability and idempotence.
-- Never debits wallets or converts legacy Muapi funds to OpenAI credits.
CREATE TABLE IF NOT EXISTS realizo_ai_projects (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES wallet_users(id),
 primary_asset_id TEXT NOT NULL REFERENCES realizo_media_assets(id),
 product_name TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL,
 audience TEXT NOT NULL DEFAULT '',
 sales_angle TEXT NOT NULL DEFAULT 'auto',
 market_code TEXT NOT NULL CHECK(length(market_code)=2),
 cta TEXT NOT NULL DEFAULT '',
 request_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'created'
   CHECK(status IN ('created','researching','ready','needs_review','approved','failed')),
 provider_response_id TEXT UNIQUE,
 concepts_json TEXT,
 sources_json TEXT,
 findings_json TEXT,
 selected_concept INTEGER CHECK(selected_concept IN (0,1,2)),
 approved_prompt TEXT,
 error_code TEXT,
 research_model TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS realizo_ai_projects_user ON realizo_ai_projects(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS realizo_ai_projects_status ON realizo_ai_projects(status,updated_at);

-- Limit paid-provider exposure in the pilot: at most one created job per
-- verified user per UTC day; daily quota is enforced with D1 row counts.
-- Future paid rollout requires separate dedicated AI-funding ledger and quote.
CREATE TABLE IF NOT EXISTS realizo_ai_usage (
 project_id TEXT PRIMARY KEY REFERENCES realizo_ai_projects(id),
 user_id TEXT NOT NULL REFERENCES wallet_users(id),
 provider TEXT NOT NULL DEFAULT 'openai',
 model TEXT NOT NULL,
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 web_calls INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
