import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateWebhookUrl, existingWebhookId } from '../scripts/register-paypal-sandbox-webhook.mjs';

const callback = 'https://realizo-sandbox.cuenta-pruebas.workers.dev/api/wallet/paypal/webhook';

test('Webhook accepts only the dedicated HTTPS sandbox worker', () => {
  assert.equal(validateWebhookUrl(callback), callback);
  for (const url of [
    'http://realizo-sandbox.cuenta-pruebas.workers.dev/api/wallet/paypal/webhook',
    'https://open-generative-ai.cuenta-pruebas.workers.dev/api/wallet/paypal/webhook',
    'https://realizo-sandbox.cuenta-pruebas.workers.dev/api/wallet',
    'https://realizo-sandbox.cuenta-pruebas.workers.dev/api/wallet/paypal/webhook?test=1',
    'https://realizo-sandbox.cuenta-pruebas.workers.dev.evil.com/api/wallet/paypal/webhook',
    'https://evil.test/api/wallet/paypal/webhook',
  ]) assert.throws(() => validateWebhookUrl(url));
});

test('Webhook registration is idempotent and rejects inconsistent existing configuration', () => {
  assert.equal(existingWebhookId([], callback), null);
  assert.equal(existingWebhookId([{ url: callback, id: 'WH-SANDBOX-1',
    event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }] }], callback), 'WH-SANDBOX-1');
  assert.throws(() => existingWebhookId([{ url: callback, id: 'WH-NO-EVENT',
    event_types: [{ name: 'OTHER' }] }], callback));
  assert.throws(() => existingWebhookId([
    { url: callback, id: 'WH-1', event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }] },
    { url: callback, id: 'WH-2', event_types: [{ name: 'PAYMENT.CAPTURE.COMPLETED' }] },
  ], callback));
});
