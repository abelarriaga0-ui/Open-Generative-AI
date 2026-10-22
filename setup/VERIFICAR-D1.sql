-- Read-only verification. No users, payment details, balances or credentials are returned.
SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'trigger') AND name NOT LIKE 'sqlite_%'
ORDER BY type, name;

SELECT COUNT(*) AS application_tables FROM sqlite_master
WHERE type = 'table' AND name IN (
  'wallet_users', 'wallets', 'model_prices', 'generation_jobs',
  'verified_deposits', 'wallet_ledger', 'paypal_topup_orders'
);

PRAGMA foreign_key_check;
