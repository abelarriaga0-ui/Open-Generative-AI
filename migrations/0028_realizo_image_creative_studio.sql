-- Realizo Images: plantillas reutilizables privadas y generaciones por cuenta.
-- No modifica la contabilidad, proveedores de pago ni plantillas de video.
CREATE TABLE IF NOT EXISTS realizo_image_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS realizo_image_uploads_owner
  ON realizo_image_uploads(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS realizo_image_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS realizo_image_presets_owner
  ON realizo_image_presets(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS realizo_image_creations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  image_job_id TEXT NOT NULL UNIQUE REFERENCES generation_jobs(id),
  research_job_id TEXT NOT NULL REFERENCES generation_jobs(id),
  upload_id TEXT NOT NULL REFERENCES realizo_image_uploads(id),
  brief_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS realizo_image_creations_owner
  ON realizo_image_creations(user_id,created_at DESC);

-- Gemini multimodal: analizar físicamente el producto, no solo los datos escritos.
UPDATE model_prices SET allowed_input_keys_json='["prompt","system_prompt","image_url"]'
 WHERE model_id='realizo_gemini_2_5_flash' AND muapi_endpoint='gemini-2-5-flash';
