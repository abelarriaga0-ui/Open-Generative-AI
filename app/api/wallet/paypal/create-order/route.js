import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { parseUsdCents, usdFromCents, paypalRequest } from '@/lib/wallet/paypal';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!enforceSameOrigin(request)) return Response.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await request.json();
    let cents;
    try { cents = parseUsdCents(body?.amount_usd); }
    catch { return Response.json({ error: 'invalid_amount' }, { status: 400 }); }
    const first = await env.WALLETS_DB.prepare(
      'SELECT COUNT(*) AS n FROM verified_deposits WHERE user_id=?'
    ).bind(user.id).first();
    if (first.n === 0 && cents < 2000) {
      return Response.json({ error: 'first_topup_minimum_20_usd' }, { status: 400 });
    }
    const intentId = crypto.randomUUID();
    try {
      await env.WALLETS_DB.prepare(
        'INSERT INTO paypal_topup_orders (id,user_id,amount_cents) VALUES (?,?,?)'
      ).bind(intentId, user.id, cents).run();
    } catch (error) {
      if (String(error).includes('first_topup_minimum_20_usd')) {
        return Response.json({ error: 'first_topup_minimum_20_usd' }, { status: 400 });
      }
      throw error;
    }
    // Price is built by our backend, never accepted from PayPal's browser callback.
    const { ok, data } = await paypalRequest(env, '/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: 'wallet-credit',
        custom_id: intentId,
        description: 'Créditos de generación Realizo (no transferibles)',
        amount: { currency_code: 'USD', value: usdFromCents(cents) },
      }],
      payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING' } } },
    }, intentId);
    if (!ok || typeof data?.id !== 'string' || !/^[A-Z0-9]{10,25}$/.test(data.id)) {
      throw new Error('paypal_create_order_failed');
    }
    await env.WALLETS_DB.prepare(
      "UPDATE paypal_topup_orders SET paypal_order_id=?,status='created',updated_at=datetime('now') WHERE id=?"
    ).bind(data.id, intentId).run();
    return Response.json({ order_id: data.id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
