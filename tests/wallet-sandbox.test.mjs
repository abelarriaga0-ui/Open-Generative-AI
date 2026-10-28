import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { paypalBaseUrl, paypalRequest, parseUsdCents, usdFromCents, confirmedCapture } from '../lib/wallet/paypal.js';
import { enforceSameOrigin, verifyAccessUser } from '../lib/wallet/access-auth.js';
import { isMuapiGenerationEnabled } from '../lib/wallet/generation-policy.js';
import { contentSecurityPolicy, walletPilotAction } from '../lib/wallet/request-policy.js';
import { checkSandboxIsolation } from '../scripts/check-sandbox-isolation.mjs';

test('PayPal defaults to Sandbox and refuses Live before sending credentials', async () => {
  assert.equal(paypalBaseUrl({}), 'https://api-m.sandbox.paypal.com');
  assert.throws(() => paypalBaseUrl({ PAYPAL_MODE: 'live' }));
  assert.throws(() => paypalBaseUrl({ PAYPAL_MODE: 'unknown' }));
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected network call'); };
  try {
    await assert.rejects(paypalRequest({
      PAYPAL_MODE: 'live', PAYPAL_CLIENT_ID: 'test-only-id', PAYPAL_CLIENT_SECRET: 'test-only-secret',
    }, '/v2/checkout/orders', 'POST', {}));
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('USD amounts use exact positive integer cents', () => {
  assert.equal(parseUsdCents('20.00'), 2000);
  assert.equal(parseUsdCents('0.01'), 1);
  assert.equal(parseUsdCents('2.5'), 250);
  assert.equal(usdFromCents(2001), '20.01');
  for (const value of ['0', '0.00', '-1', '1.001', '1e3', 'NaN', 'Infinity', '20,00', 20, null]) {
    assert.throws(() => parseUsdCents(value));
  }
});

const intent = { id: 'intent-a', paypal_order_id: 'ORDER-123', amount_cents: 2000 };
function paidOrder() {
  return { id: 'ORDER-123', status: 'COMPLETED', purchase_units: [{
    custom_id: 'intent-a', amount: { value: '20.00', currency_code: 'USD' },
    payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED',
      amount: { value: '20.00', currency_code: 'USD' } }] },
  }] };
}

test('only the exact completed capture for the stored order is accepted', () => {
  assert.equal(confirmedCapture(paidOrder(), intent).id, 'CAPTURE-1');
  const mutations = [
    order => { order.id = 'OTHER-ORDER'; },
    order => { order.status = 'APPROVED'; },
    order => { order.purchase_units[0].custom_id = 'other-user-intent'; },
    order => { order.purchase_units[0].amount.value = '0.01'; },
    order => { order.purchase_units[0].amount.currency_code = 'EUR'; },
    order => { order.purchase_units[0].payments.captures[0].amount.value = '0.01'; },
    order => { order.purchase_units[0].payments.captures[0].status = 'PENDING'; },
    order => { order.purchase_units[0].payments.captures.push(order.purchase_units[0].payments.captures[0]); },
  ];
  for (const mutate of mutations) {
    const order = paidOrder(); mutate(order);
    assert.equal(confirmedCapture(order, intent), null);
  }
});

test('Sandbox balances cannot spend real Muapi funds, even with the flag set', () => {
  for (const env of [{}, { PAYPAL_MODE: 'sandbox', MUAPI_GENERATION_ENABLED: 'true' },
    { REALIZO_ENV: 'sandbox', PAYPAL_MODE: 'live', MUAPI_GENERATION_ENABLED: 'true' }]) {
    assert.equal(isMuapiGenerationEnabled(env), false);
  }
});

test('legacy BYOK APIs and pages are excluded from the wallet pilot', () => {
  for (const path of ['/api/v1/generate', '/api/workflow', '/api/app', '/api/wallet-evil', '/api/generate.js']) {
    assert.equal(walletPilotAction(path, true), 'deny');
  }
  for (const path of ['/', '/studio', '/settings', '/es']) {
    assert.equal(walletPilotAction(path, true), 'redirect');
  }
  for (const path of ['/wallet', '/api/wallet', '/api/wallet/paypal/webhook', '/_next/static/main.js']) {
    assert.equal(walletPilotAction(path, true), 'allow');
  }
  assert.equal(walletPilotAction('/studio', false), 'allow');
});

test('PayPal scripts and frames are allowed only on the wallet page', () => {
  const policy = contentSecurityPolicy('/wallet');
  for (const directive of ['script-src', 'frame-src', 'connect-src', 'child-src']) {
    assert.match(policy.split(';').find(part => part.trim().startsWith(directive)), /https:\/\/\*\.paypal\.com/);
  }
  assert.doesNotMatch(contentSecurityPolicy('/studio'), /paypal/);
});

test('missing, foreign and malformed Origin headers fail closed', () => {
  const url = 'https://realizo.example/api/wallet/paypal/create-order';
  assert.equal(enforceSameOrigin(new Request(url, { headers: { origin: 'https://realizo.example' } })), true);
  for (const origin of ['', 'null', 'https://other.example', '%%%']) {
    assert.equal(enforceSameOrigin(new Request(url, { headers: { origin } })), false);
  }
});

test('unsigned identity headers do not select a wallet', async () => {
  const request = new Request('https://realizo.example/api/wallet', {
    headers: { 'cf-access-authenticated-user-email': 'fake@example.com', 'x-user-id': 'user-a' },
  });
  assert.equal(await verifyAccessUser(request, { CF_ACCESS_TEAM_DOMAIN: 'example', CF_ACCESS_AUD: 'aud' }), null);
});

test('Sandbox configuration names a separate worker and explicitly uses test settings', () => {
  const sandbox = JSON.parse(readFileSync('wrangler.sandbox.jsonc', 'utf8'));
  const original = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.notEqual(sandbox.name, original.name);
  assert.equal(sandbox.name, 'realizo-sandbox');
  assert.equal(sandbox.vars.PAYPAL_MODE, 'sandbox');
  assert.equal(sandbox.vars.REALIZO_ENV, 'sandbox');
  assert.equal(sandbox.vars.REALIZO_WALLET_ONLY, 'true');
  assert.equal(sandbox.vars.MUAPI_GENERATION_ENABLED, 'false');
  assert.equal(sandbox.d1_databases[0].binding, 'WALLETS_DB');
  assert.equal(sandbox.d1_databases[0].database_name, 'realizo-wallets-sandbox');
  assert.equal(sandbox.d1_databases[0].migrations_dir, 'migrations');
  assert.equal(sandbox.vars.MUAPI_API_KEY, undefined);
  assert.equal(sandbox.vars.PAYPAL_CLIENT_SECRET, undefined);
});


test('remote operation guard rejects placeholder, shared D1 and unsafe flags', () => {
  const original = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const sandbox = JSON.parse(readFileSync('wrangler.sandbox.jsonc', 'utf8'));
  const clone = () => JSON.parse(JSON.stringify(sandbox));
  const withDedicatedDb = clone();
  withDedicatedDb.d1_databases[0].database_id = '123e4567-e89b-12d3-a456-426614174000';
  assert.equal(checkSandboxIsolation(withDedicatedDb, original), true);
  const missing = clone();
  missing.d1_databases[0].database_id = '00000000-0000-0000-0000-000000000000';
  assert.throws(() => checkSandboxIsolation(missing, original), /UUID pendiente|reemplaza el UUID/);
  const shared = clone();
  shared.d1_databases[0].database_id = original.d1_databases[0].database_id;
  assert.throws(() => checkSandboxIsolation(shared, original), /comparte base de datos/);
  const live = clone();
  live.d1_databases[0].database_id = '123e4567-e89b-12d3-a456-426614174000';
  live.vars.PAYPAL_MODE = 'live';
  assert.throws(() => checkSandboxIsolation(live, original), /insegura/);
});
