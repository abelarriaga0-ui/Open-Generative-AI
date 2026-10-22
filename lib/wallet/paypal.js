import { WalletSetupError } from './server.js';

// Sandbox unless explicitly switched by a verified operator setting.
export function paypalBaseUrl(env) {
  const mode = env.PAYPAL_MODE || 'sandbox';
  if (mode === 'sandbox') return 'https://api-m.sandbox.paypal.com';
  if (mode === 'live') return 'https://api-m.paypal.com';
  throw new WalletSetupError('PAYPAL_MODE inválido; elige sandbox o live.');
}

export function assertPaypalConfigured(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new WalletSetupError('Configura PAYPAL_CLIENT_ID y el secreto PAYPAL_CLIENT_SECRET en Cloudflare.');
  }
}

export function usdFromCents(cents) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('invalid_amount');
  return (Math.floor(cents / 100)) + '.' + String(cents % 100).padStart(2, '0');
}

export function parseUsdCents(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/.test(value)) {
    throw new Error('invalid_amount');
  }
  const [dollars, decimal = ''] = value.split('.');
  const amount = Number(dollars) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('invalid_amount');
  return amount;
}

export async function paypalAccessToken(env) {
  assertPaypalConfigured(env);
  const credentials = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET);
  const response = await fetch(paypalBaseUrl(env) + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('paypal_auth_unavailable');
  const payload = await response.json();
  if (!payload.access_token) throw new Error('paypal_auth_invalid');
  return payload.access_token;
}

export async function paypalRequest(env, path, method = 'GET', body = null, requestId = null) {
  const accessToken = await paypalAccessToken(env);
  const headers = {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const response = await fetch(paypalBaseUrl(env) + path, {
    method,
    headers,
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, httpStatus: response.status, data };
}

export function confirmedCapture(paypalOrder, intent) {
  // Require the order to be COMPLETED and exactly the original checkout amount.
  if (paypalOrder?.id !== intent.paypal_order_id || paypalOrder.status !== 'COMPLETED') {
    return null;
  }
  const units = paypalOrder.purchase_units;
  if (!Array.isArray(units) || units.length !== 1) return null;
  const unit = units[0];
  if (unit.custom_id !== intent.id ||
      unit.amount?.currency_code !== 'USD' ||
      unit.amount?.value !== usdFromCents(intent.amount_cents)) return null;
  const captures = unit.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) return null;
  const capture = captures[0];
  if (capture.status !== 'COMPLETED' || typeof capture.id !== 'string' ||
      !capture.id || capture.amount?.currency_code !== 'USD' ||
      capture.amount?.value !== usdFromCents(intent.amount_cents)) return null;
  return capture;
}

export async function settlePaypalOrder(db, paypalOrderId, verifiedPaypalOrder) {
  const intent = await db.prepare(
    'SELECT id,user_id,paypal_order_id,amount_cents,status FROM paypal_topup_orders WHERE paypal_order_id=?'
  ).bind(paypalOrderId).first();
  if (!intent) return { status: 'unknown_order' };
  if (intent.status === 'paid') return { status: 'paid' };
  const capture = confirmedCapture(verifiedPaypalOrder, intent);
  if (!capture) return { status: 'pending' };

  // UNIQUE(payment_provider, payment_reference) prevents double credit on retries/webhooks.
  // A D1 trigger credits this specific user's wallet atomically with the verified deposit.
  await db.prepare(
    'INSERT OR IGNORE INTO verified_deposits ' +
    '(id,user_id,payment_provider,payment_reference,amount_cents,charged_currency,charged_amount_minor) ' +
    "VALUES (?,?,?,?,?,'USD',?)"
  ).bind(
    'paypal:' + capture.id,
    intent.user_id,
    'paypal',
    capture.id,
    intent.amount_cents,
    intent.amount_cents
  ).run();
  await db.prepare(
    "UPDATE paypal_topup_orders SET status='paid',paypal_capture_id=?,updated_at=datetime('now') " +
    "WHERE id=? AND status <> 'paid'"
  ).bind(capture.id, intent.id).run();
  return { status: 'paid' };
}
