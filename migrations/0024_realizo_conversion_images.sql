-- Imagen premium 4K: USD 0.135 en Muapi; precio de usuario USD 0.14 por generación.
-- Análisis opcional Gemini: tarifa plana de USD 0.01 por solicitud (NO por token exacto).
INSERT OR IGNORE INTO model_prices
  (model_id,muapi_endpoint,customer_price_cents,allowed_input_keys_json,fixed_options_json,enabled)
VALUES
 ('realizo_gemini_2_5_flash','gemini-2-5-flash',1,'["prompt","system_prompt"]','{}',1),
 ('realizo_nano_banana_2_1_edit_4k','nano-banana-2-1-edit',14,
  '["prompt","images_list"]','{"resolution":"4k","output_format":"png","aspect_ratio":"2:3","google_search":false}',1);
