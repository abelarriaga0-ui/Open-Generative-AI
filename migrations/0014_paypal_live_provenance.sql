-- Record source environment of every PayPal-settled wallet deposit.
-- All existing deposits are 'unknown' and never qualify for AI Premium
-- funding until explicitly reverified against PayPal Live.
ALTER TABLE verified_deposits ADD COLUMN provider_environment TEXT NOT NULL DEFAULT 'unknown'
 CHECK(provider_environment IN ('unknown','sandbox','live'));
CREATE INDEX IF NOT EXISTS verified_deposits_live_by_user
 ON verified_deposits(user_id,payment_provider,provider_environment);
