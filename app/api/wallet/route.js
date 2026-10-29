import {
  getWalletEnvironment, requireWalletUser, getWallet,
  getWalletActivity, getActiveModels, jsonError
} from '@/lib/wallet/server';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const [balance, activity, catalog, previousDeposits] = await Promise.all([
      getWallet(env.WALLETS_DB, user.id),
      getWalletActivity(env.WALLETS_DB, user.id),
      getActiveModels(env.WALLETS_DB),
      env.WALLETS_DB.prepare('SELECT COUNT(*) AS total FROM verified_deposits WHERE user_id=?').bind(user.id).first(),
    ]);
    return Response.json({
      user: { email: user.email },
      wallet: balance,
      activity: activity.results ?? [],
      models: catalog.results ?? [],
      min_topup_cents: previousDeposits.total > 0 ? 1 : 2000,
      first_topup: previousDeposits.total === 0,
      currency: 'USD',
      generation_enabled: isMuapiGenerationEnabled(env) && Boolean(env.MUAPI_API_KEY),
      checkout_enabled: (env.PAYPAL_MODE || 'sandbox') === 'sandbox' &&
        Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID),
      environment: env.REALIZO_ENV || 'unconfigured',
      message: 'Entorno de pruebas: las recargas Sandbox no representan dinero real.'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
