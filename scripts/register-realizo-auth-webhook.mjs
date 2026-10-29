// PayPal Sandbox webhook registration. No Live endpoints or arbitrary callback URLs.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PAYPAL = 'https://api-m.sandbox.paypal.com';
const EVENT = 'PAYMENT.CAPTURE.COMPLETED';

export function validateWebhookUrl(candidate) {
  const url = new URL(candidate);
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      url.search || url.hash ||
      !/^realizo-auth-sandbox\.[a-z0-9-]+\.workers\.dev$/i.test(url.hostname) ||
      url.pathname !== '/api/wallet/paypal/webhook') {
    throw new Error('URL rechazada: se requiere el webhook específico del Worker realizo-auth-sandbox.');
  }
  return url.href;
}

export function existingWebhookId(webhooks, webhookUrl) {
  if (!Array.isArray(webhooks)) throw new Error('Listado de webhooks de PayPal inválido.');
  const matches = webhooks.filter(webhook => webhook?.url === webhookUrl);
  if (matches.length > 1) throw new Error('Se encontraron webhooks duplicados: revisión manual requerida.');
  if (!matches.length) return null;
  const hook = matches[0];
  if (!hook.event_types?.some(e => e.name === EVENT) ||
      typeof hook.id !== 'string' || !hook.id.trim()) {
    throw new Error('Webhook existente sin evento de captura: revisar manualmente.');
  }
  return hook.id;
}

async function paypalRequest(path, options = {}) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('Faltan credenciales PayPal Sandbox.');
  const response = await fetch(PAYPAL + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('PayPal Sandbox OAuth no autorizado: HTTP ' + response.status);
  const auth = await response.json();
  if (!auth?.access_token) throw new Error('No se obtuvo un token PayPal Sandbox.');
  const api = await fetch(PAYPAL + path, {
    method: options.method || 'GET',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: 'Bearer ' + auth.access_token,
      'Content-Type': 'application/json',
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!api.ok) throw new Error('PayPal Sandbox webhook no disponible: HTTP ' + api.status);
  return api.json();
}

export async function registerSandboxWebhook() {
  const callback = validateWebhookUrl(process.env.REALIZO_AUTH_SANDBOX_WEBHOOK_URL);
  // Ensure the worker exists and is reachable. Do not accidentally subscribe
  // an unverified URL or create a webhook pointing at an absent server.
  const health = await fetch(callback, { method: 'GET', redirect: 'manual',
    signal: AbortSignal.timeout(15000) });
  // Route supports POST only: Next returns 405. A 401/503/302 means guarded,
  // but cannot be independently verified as the expected application.
  if (health.status !== 405) {
    throw new Error('Webhook no confirmado en Worker Sandbox: HTTP ' + health.status);
  }
  const response = await paypalRequest('/v1/notifications/webhooks');
  let id = existingWebhookId(response.webhooks || [], callback);
  if (!id) {
    const created = await paypalRequest('/v1/notifications/webhooks', {
      method: 'POST',
      body: { url: callback, event_types: [{ name: EVENT }] },
    });
    if (created?.url !== callback || typeof created.id !== 'string' || !created.id.trim()) {
      throw new Error('La creación de webhook devolvió una respuesta inesperada.');
    }
    id = created.id;
    console.log('Webhook de captura creado en PayPal Sandbox.');
  } else {
    console.log('Webhook PayPal Sandbox existente verificado; no se creó un duplicado.');
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, 'webhook_id=' + id + '\n');
  }
  console.log('Webhook id verificado; sin transacciones de dinero real.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await registerSandboxWebhook();
  } catch (error) {
    console.error(error?.message || 'No se pudo configurar el webhook Sandbox.');
    process.exitCode = 1;
  }
}
