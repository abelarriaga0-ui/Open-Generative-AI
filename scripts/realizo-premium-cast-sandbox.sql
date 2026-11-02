-- Apply only to the isolated Realizo Sandbox D1 before deploying cast mode.
-- Production needs a separately authorized migration.
ALTER TABLE realizo_ai_projects
ADD COLUMN cast_mode TEXT NOT NULL DEFAULT 'with_people'
CHECK (cast_mode IN ('product_only', 'with_people'));
