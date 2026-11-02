-- Optional explicit customer edits for a locked Muapi master template.
-- No wallet or payment changes.
ALTER TABLE realizo_ai_projects ADD COLUMN template_change_request TEXT DEFAULT '';
