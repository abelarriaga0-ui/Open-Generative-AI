// Controlled single-user import of USD 7.75 paid directly in Muapi before Realizo.
 // Runs only in GitHub Actions with protected secrets and Sandbox D1 credentials.
 // Never prints account IDs, emails, API keys, or user-supplied data.
const ACCOUNT_ID = '7e405c54c1a91abbdad537f7fec379a1';
const SANDBOX_DB_ID = '2561f6c8-bfb2-4ea4-8527-7fec29188edf';
const IMPORT_CENTS = 775;
const e = process.env;

if (e.REALIZO_ENV !== 'sandbox' || e.PAYPAL_MODE !== 'sandbox' ||
    e.REALIZO_AUTH_PROVIDER !== 'native' || e.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT_ID ||
    e.REALIZO_D1_SANDBOX !== SANDBOX_DB_ID) {
  throw new Error('Historical import requires exact Realizo native Sandbox account, D1 and payment mode');
}
if (!e.CLOUDFLARE_API_TOKEN || !e.REALIZO_MUAPI_API_KEY) {
  throw new Error('Cloudflare and Muapi secrets must be supplied by protected GitHub Actions secrets');
}

const dbUrl = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT_ID +
  '/d1/database/' + SANDBOX_DB_ID + '/query';
async function query(sql, params = []) {
  const response = await fetch(dbUrl, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + e.CLOUDFLARE_API_TOKEN, 'Content-Type': 'application/json'},
    body: JSON.stringify({sql, params}),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success || !body.result?.[0]?.success) {
    throw new Error('Sandbox D1 operation rejected (HTTP ' + response.status + ')');
  }
  return body.result[0];
}
function count(rows) {
  if (rows.length !== 1) throw new Error('Unexpected account count response');
  return Number(rows[0].n);
}
const pilotUsers = await query("SELECT id FROM wallet_users WHERE auth_provider='realizo' ORDER BY id LIMIT 2");
const totalNative = count((await query("SELECT COUNT(*) AS n FROM wallet_users WHERE auth_provider='realizo'")).results);
const grants = (await query('SELECT user_id, amount_cents FROM realizo_muapi_pilot_grants')).results;
if (totalNative !== 1 || pilotUsers.results.length !== 1 || grants.length !== 1 ||
    grants[0].user_id !== pilotUsers.results[0].id || Number(grants[0].amount_cents) !== 35) {
  throw new Error('Native user must uniquely match existing verified 35-cent pilot grant');
}
const userId = pilotUsers.results[0].id;
if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid database user identifier');

const providerResponse = await fetch('https://api.muapi.ai/api/v1/account/balance', {
  headers: {'x-api-key': e.REALIZO_MUAPI_API_KEY},
  signal: AbortSignal.timeout(20000),
});
if (!providerResponse.ok) throw new Error('Muapi balance verification failed HTTP ' + providerResponse.status);
const providerJson = await providerResponse.json();
const providerBalanceUsd = Number(providerJson.balance);
if (!Number.isFinite(providerBalanceUsd) || Math.round(providerBalanceUsd * 100) < IMPORT_CENTS) {
  throw new Error('Real Muapi balance is below USD 7.75; no internal credit was created');
}

const existing = (await query('SELECT user_id,amount_cents FROM realizo_prepaid_muapi_imports WHERE slot=1')).results;
if (existing.length) {
  if (existing[0].user_id !== userId || Number(existing[0].amount_cents) !== IMPORT_CENTS)
    throw new Error('Historical Muapi credit already belongs to another user or amount');
  console.log('HISTORIC_MUAPI_CREDIT=ALREADY_APPLIED; no duplicate credit.');
  process.exit(0);
}
const beforeRows = (await query('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?', [userId])).results;
if (beforeRows.length !== 1) throw new Error('Native account wallet missing');
const before = beforeRows[0];
// SQLite trigger credits balance atomically with the one-time import row and ledger.
const inserted = await query(
  "INSERT OR IGNORE INTO realizo_prepaid_muapi_imports(slot,user_id,amount_cents,source) VALUES(1,?,?,?)",
  [userId, IMPORT_CENTS, 'User prepaid Muapi directly before Realizo PayPal integration']
);
if (Number(inserted.meta?.changes) !== 1) {
  throw new Error('Credit was not newly inserted; inspect existing import before retrying');
}
const afterRows = (await query('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?', [userId])).results;
const after = afterRows[0];
const ledger = (await query("SELECT available_delta_cents FROM wallet_ledger WHERE external_reference='historical-muapi-prepaid:1'")).results;
if (Number(after.available_cents) - Number(before.available_cents) !== IMPORT_CENTS ||
    Number(after.reserved_cents) !== Number(before.reserved_cents) ||
    ledger.length !== 1 || Number(ledger[0].available_delta_cents) !== IMPORT_CENTS) {
  throw new Error('Import executed but ledger verification is inconsistent: manual review required');
}
console.log('HISTORIC_MUAPI_CREDIT=SUCCESS; +USD 7.75 to one existing native Realizo user.');
console.log('Muapi provider balance was verified; no new payment or video generation executed.');
console.log('PayPal remained in Sandbox and user IDs, emails and credentials were not printed.');
