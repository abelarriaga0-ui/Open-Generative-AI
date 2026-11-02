-- Isolated Sandbox ONLY. Production requires separately authorized migration.
-- Existing videos/projects are not modified.
ALTER TABLE realizo_ai_projects
ADD COLUMN audio_mode TEXT NOT NULL DEFAULT 'no_voice'
CHECK (audio_mode IN ('no_voice','voiceover','dialogue'));
