-- Production PayPal deposits must not treat earlier Sandbox/test deposits as successful Live funding.
-- Non-destructive migration: no balances or user data are modified.
CREATE TRIGGER IF NOT EXISTS paypal_live_first_topup_minimum
BEFORE INSERT ON paypal_topup_orders
WHEN NEW.amount_cents < 2000 AND NOT EXISTS (
  SELECT 1 FROM verified_deposits
  WHERE user_id=NEW.user_id AND payment_provider='paypal' AND provider_environment='live'
)
BEGIN
  SELECT RAISE(ABORT, 'first_topup_minimum_20_usd');
END;

CREATE TRIGGER IF NOT EXISTS paypal_live_first_verified_deposit_minimum
BEFORE INSERT ON verified_deposits
WHEN NEW.payment_provider='paypal'
  AND NEW.provider_environment='live'
  AND NEW.amount_cents < 2000 AND NOT EXISTS (
    SELECT 1 FROM verified_deposits
    WHERE user_id=NEW.user_id AND payment_provider='paypal' AND provider_environment='live'
  )
BEGIN
  SELECT RAISE(ABORT, 'first_topup_minimum_20_usd');
END;
