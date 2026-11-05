-- Initial-step video delivery options: preserve customer choices through approval and billing.
-- Does not modify wallets, balances, reservations, generation_jobs or legacy projects.
ALTER TABLE realizo_ai_projects ADD COLUMN video_settings_json TEXT NOT NULL DEFAULT '{}';
