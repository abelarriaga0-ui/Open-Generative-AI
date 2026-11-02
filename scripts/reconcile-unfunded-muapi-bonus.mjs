// Reverse exactly the earlier unfunded $0.35 pilot bonus. The owner's
// historical $7.75 Muapi import remains untouched. Run only with GitHub
// Actions secrets on Realizo's isolated native-auth Sandbox D1.
const ACCOUNT_ID = '7e405c54c1a91abbdad537f7fec379a1';
const D1_ID = '2561f6c8-bfb2-4ea4-8527-7fec29188edf';
const env = process.env;
const AMOUNT_CENTS = 35;
const REAL_CENTS = 775;

if (env.REALIZO_ENV !== 'sandbox' ||
    env.PAYPAL_MODE !== 'sandbox' ||
    env.REALIZO_AUTH_PROVIDER !== 'native' ||
    env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT_ID ||
    env.REALIZO_D1_SANDBOX !== D1_ID) {
  throw new Error('Only the isolated Realizo native Sandbox wallet may be reconciled');
}
if (!env.CLOUDFLARE_API_TOKEN || !env.REALIZO_MUAPI_API_KEY) {
  throw new Error('Required protected Cloudflare/Muapi secret not configured');
}
const url = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT_ID +
  '/d1/database/' + D1_ID + '/query';

async function query(sql, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.CLOUDFLARE_API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success !== true ||
      !payload.result?.[0] || payload.result[0].success === false) {
    throw new Error('D1 query could not be verified (HTTP ' + response.status + ')');
  }
  return payload.result[0].results ?? [];
}
const grants = await query('SELECT user_id, amount_cents FROM realizo_muapi_pilot_grants WHERE slot=1');
const imports = await query('SELECT user_id, amount_cents FROM realizo_prepaid_muapi_imports WHERE slot=1');
if (grants.length !== 1 || imports.length !== 1 ||
    grants[0].user_id !== imports[0].user_id ||
    Number(grants[0].amount_cents) !== AMOUNT_CENTS ||
    Number(imports[0].amount_cents) !== REAL_CENTS) {
  throw new Error('Pilot credit and prepaid credit do not identify the same verified owner');
}
const owner = grants[0].user_id;
if (!/^[0-9a-f-]{36}$/i.test(owner)) throw new Error('Unexpected identity type');
const users = await query("SELECT auth_provider FROM wallet_users WHERE id=?", [owner]);
if (users.length !== 1 || users[0].auth_provider !== 'realizo') {
  throw new Error('Pilot wallet does not belong to the verified Realizo user');
}

async function verifyReverseLedger() {
  const rows = await query(
    "SELECT user_id,kind,available_delta_cents,reserved_delta_cents FROM wallet_ledger WHERE external_reference='pilot-credit:1:reversed'"
  );
  if (rows.length !== 1 || rows[0].user_id !== owner ||
      rows[0].kind !== 'deposit' ||
      Number(rows[0].available_delta_cents) !== -AMOUNT_CENTS ||
      Number(rows[0].reserved_delta_cents) !== 0) {
    throw new Error('Audit ledger does not contain the exact pilot bonus reversal');
  }
}
const existing = await query('SELECT user_id, amount_cents FROM realizo_pilot_grant_reversals WHERE slot=1');
if (existing.length) {
  if (existing.length !== 1 || existing[0].user_id !== owner ||
      Number(existing[0].amount_cents) !== AMOUNT_CENTS) {
    throw new Error('Existing reversal does not match the authorized owner');
  }
  await verifyReverseLedger();
  console.log('UNFUNDED_PILOT_BONUS=ALREADY_REVERSED_AND_AUDITED; no duplicate debit');
  process.exit(0);
}
const balanceResponse = await fetch('https://api.muapi.ai/api/v1/account/balance', {
  headers: { 'x-api-key': env.REALIZO_MUAPI_API_KEY },
  signal: AbortSignal.timeout(20000),
});
if (!balanceResponse.ok) {
  throw new Error('Unable to verify Muapi provider balance (HTTP ' + balanceResponse.status + ')');
}
const provider = await balanceResponse.json();
const providerCents = Math.round(Number(provider.balance) * 100);
if (!Number.isSafeInteger(providerCents) || providerCents !== REAL_CENTS) {
  throw new Error('Muapi real balance does not equal USD 7.75: cancel the operation and reconcile manually');
}

const before = await query('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?', [owner]);
if (before.length !== 1 || Number(before[0].available_cents) !== 810 ||
    Number(before[0].reserved_cents) !== 0) {
  throw new Error('Wallet is no longer USD 8.10 with no reservations; no automatic debit performed');
}
// A single SQLite INSERT fires triggers that audit the reversal and subtract
// exactly 35 cents atomically. Repeating cannot double-debit (unique slot).
await query(
  'INSERT INTO realizo_pilot_grant_reversals (slot,user_id,amount_cents) SELECT 1,?,? WHERE NOT EXISTS (SELECT 1 FROM realizo_pilot_grant_reversals WHERE slot=1)',
  [owner, AMOUNT_CENTS]
);
const [after, reversal, historical, grantsStillExist] = await Promise.all([
  query('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?', [owner]),
  query('SELECT user_id, amount_cents FROM realizo_pilot_grant_reversals WHERE slot=1'),
  query('SELECT user_id, amount_cents FROM realizo_prepaid_muapi_imports WHERE slot=1'),
  query('SELECT user_id, amount_cents FROM realizo_muapi_pilot_grants WHERE slot=1'),
]);
await verifyReverseLedger();
if (after.length !== 1 || Number(after[0].available_cents) !== REAL_CENTS ||
    Number(after[0].reserved_cents) !== 0 ||
    reversal.length !== 1 || reversal[0].user_id !== owner ||
    Number(reversal[0].amount_cents) !== AMOUNT_CENTS ||
    historical.length !== 1 || historical[0].user_id !== owner ||
    Number(historical[0].amount_cents) !== REAL_CENTS ||
    grantsStillExist.length !== 1) {
  throw new Error('Reversal needs manual review: D1 verification was not fully consistent');
}
console.log('REALIZO_WALLET_RECONCILED=SUCCESS; wallet USD 7.75 matches Muapi USD 7.75.');
console.log('The pilot bonus USD 0.35 is cancelled exactly once; historical credit remains.');
console.log('No PayPal charge, provider generation, or production modification occurred.');
