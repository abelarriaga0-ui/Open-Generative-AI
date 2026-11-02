-- Ejecutar únicamente en D1 del entorno autorizado tras aprobar las tarifas reales.
-- Los registros nuevos quedan DESHABILITADOS: no permite cargos accidentales.
INSERT OR IGNORE INTO model_prices
  (model_id,muapi_endpoint,customer_price_cents,allowed_input_keys_json,fixed_options_json,enabled)
VALUES
  ('realizo_gemini_2_5_flash','gemini-2-5-flash',1,
   '["prompt","system_prompt"]','{}',0),
  ('realizo_nano_banana_2_1_edit_4k','nano-banana-2-1-edit',1,
   '["prompt","images_list"]',
   '{"resolution":"4k","output_format":"png","aspect_ratio":"2:3","google_search":false}',0);

-- Configurar las variables de Cloudflare Worker (sin secretos en el repositorio):
-- REALIZO_TEMPLATE_ANALYZER_MODEL_ID=realizo_gemini_2_5_flash
-- REALIZO_TEMPLATE_IMAGE_MODEL_ID=realizo_nano_banana_2_1_edit_4k
-- REALIZO_TEMPLATE_EXPLOSION_URL=https://URL-PUBLICA-AL-ORIGINAL-EN-ALTA-RESOLUCION.webp
-- NO habilitar estas filas con precio de 1 cent. Es SOLO VALOR TEMPORAL.
-- Tras confirmar tarifa final, actualizar customer_price_cents y enabled=1 en entorno autorizado.
-- Gemini cobra según tokens; esta tabla en centavos aplica PRECIO FIJO POR SOLICITUD.
-- Para cobro exacto por tokens se requeriría contabilidad subcentavo y conciliación con usage real.
