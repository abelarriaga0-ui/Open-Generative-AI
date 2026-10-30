import { getWalletEnvironment, jsonError } from '@/lib/wallet/server';
import { paypalRequest, settlePaypalOrder } from '@/lib/wallet/paypal';
export const dynamic = 'force-dynamic';

// PayPal calls this route without a user session. Signature verification is mandatory.
// Do NOT expose a generic "add credit" endpoint, and do NOT forward this to Muapi.
export async function POST(request) {
  try {
    const env = await getWalletEnvironment();
    if (!env.PAYPAL_WEBHOOK_ID) {
      return Response.json({ error: 'paypal_webhook_not_configured' }, { status: 503 });
    }
    const raw = await request.text();
    if (raw.length > 200000) return Response.json({ error: 'payload_too_large' }, { status: 413 });
    let event;
    try { event = JSON.parse(raw); }
    catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
    const headerNames = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
      'paypal-transmission-sig', 'paypal-transmission-time'];
    if (headerNames.some(name => !request.headers.get(name))) {
      return Response.json({ error: 'missing_signature_headers' }, { status: 401 });
    }
    const verification = await paypalRequest(env, '/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: request.headers.get('paypal-auth-algo'),
      cert_url: request.headers.get('paypal-cert-url'),
      transmission_id: request.headers.get('paypal-transmission-id'),
      transmission_sig: request.headers.get('paypal-transmission-sig'),
      transmission_time: request.headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    });
    if (!verification.ok || verification.data.verification_status !== 'SUCCESS') {
      return Response.json({ error: 'unverified_webhook' }, { status: 401 });
    }
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      // Other payment state transitions need review before live release.
      return Response.json({ acknowledged: true, ignored_event: true });
    }
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (typeof orderId !== 'string' || !/^[A-Z0-9]{10,25}$/.test(orderId)) {
      return Response.json({ acknowledged: true, ignored_event: true });
    }
    const order = await paypalRequest(env, '/v2/checkout/orders/' + orderId);
    if (!order.ok) return Response.json({ error: 'paypal_order_not_ready' }, { status: 503 });
    const result = await settlePaypalOrder(env.WALLETS_DB, orderId, order.data);
    if (result.status === 'pending') {
      return Response.json({ error: 'capture_not_final' }, { status: 503 });
    }
    return Response.json({ acknowledged: true });
  } catch (error) { return jsonError(error); }
}
