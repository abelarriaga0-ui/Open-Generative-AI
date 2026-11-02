-- Keep commercial format fixed before any paid OpenAI research.
-- Existing projects remain 'auto' and retain their paid research history.
ALTER TABLE realizo_ai_projects ADD COLUMN creative_style TEXT NOT NULL DEFAULT 'auto'
 CHECK(creative_style IN ('auto','ugc','cinematic','premium','demo'));
