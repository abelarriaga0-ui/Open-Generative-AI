import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { paypalRequest, settlePaypalOrder } from '@/lib/wallet/paypal';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!enforceSameOrigin(request)) return Response.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await request.json();
    const orderId = body?.order_id;
    if (typeof orderId !== 'string' || !/^[A-Z0-9]{10,25}$/.test(orderId)) {
      return Response.json({ error: 'invalid_order_id' }, { status: 400 });
    }
    const intent = await env.WALLETS_DB.prepare(
      'SELECT id,status FROM paypal_topup_orders WHERE paypal_order_id=? AND user_id=?'
    ).bind(orderId, user.id).first();
    if (!intent) return Response.json({ error: 'order_not_found' }, { status: 404 });
    if (intent.status === 'paid') return Response.json({ status: 'paid', credited: true });

    // Idempotent capture: repeated clicks use a deterministic PayPal-Request-Id.
    const capture = await paypalRequest(
      env, '/v2/checkout/orders/' + orderId + '/capture',
      'POST', {}, intent.id,
    );
    // A network / partial response could still mean the money was captured.
    // Always fetch the authoritative order and verify it; never trust browser claims.
    const fetched = await paypalRequest(env, '/v2/checkout/orders/' + orderId);
    if (!fetched.ok) {
      return Response.json({ status: 'pending', message: 'Pago pendiente de verificación.' }, { status: 202 });
    }
    if (!capture.ok && fetched.data?.status !== 'COMPLETED') {
      return Response.json({ status: 'pending', message: 'Pago todavía no confirmado.' }, { status: 202 });
    }
    const result = await settlePaypalOrder(env.WALLETS_DB, orderId, fetched.data, env.PAYPAL_MODE||'sandbox');
    return Response.json(result, { status: result.status === 'paid' ? 200 : 202 });
  } catch (error) { return jsonError(error); }
}
