import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { assertPaypalConfigured, paypalBaseUrl } from '@/lib/wallet/paypal';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    assertPaypalConfigured(env);
    paypalBaseUrl(env);
    if (!env.PAYPAL_WEBHOOK_ID) throw new Error('paypal_webhook_not_configured');
    return Response.json({
      client_id: env.PAYPAL_CLIENT_ID, currency: 'USD',
      mode: env.PAYPAL_MODE || 'sandbox'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
