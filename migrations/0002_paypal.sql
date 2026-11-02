-- 0002_paypal.sql: PayPal Checkout orders for prepaid, non-transferable USD credits.
-- Apply AFTER migrations/0001_wallet.sql.
CREATE TABLE IF NOT EXISTS paypal_topup_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES wallet_users(id),
  paypal_order_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'creating'
    CHECK(status IN ('creating', 'created', 'paid', 'failed', 'manual_review')),
  paypal_capture_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS paypal_topups_user ON paypal_topup_orders(user_id, created_at DESC);

-- The first prepaid top-up must cost at least USD 20; subsequent can be smaller.
-- This is also checked when creating a PayPal checkout order.
CREATE TRIGGER IF NOT EXISTS paypal_first_topup_minimum
BEFORE INSERT ON paypal_topup_orders
WHEN NEW.amount_cents < 2000 AND NOT EXISTS (
  SELECT 1 FROM verified_deposits WHERE user_id=NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'first_topup_minimum_20_usd');
END;
