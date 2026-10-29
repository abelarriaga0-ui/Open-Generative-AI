-- One low-cost, locked preset for the explicitly authorized Muapi Sandbox pilot.
-- Never enable this by migration. Activation requires key, verified owner ID,
-- one-slot quota, and operator-reviewed provider rate and 35-cent user price.
INSERT OR IGNORE INTO model_prices
(model_id,muapi_endpoint,customer_price_cents,allowed_input_keys_json,fixed_options_json,enabled)
VALUES
('wan2.2-image-to-video','wan2.2-image-to-video',35,
 '["prompt","image_url","aspect_ratio"]',
 '{"duration":5,"resolution":"480p","quality":"medium"}',0);
