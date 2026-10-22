import {
  getWalletEnvironment, requireWalletUser, getWallet,
  getWalletActivity, getActiveModels, jsonError
} from '@/lib/wallet/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const [balance, activity, catalog] = await Promise.all([
      getWallet(env.WALLETS_DB, user.id),
      getWalletActivity(env.WALLETS_DB, user.id),
      getActiveModels(env.WALLETS_DB),
    ]);
    return Response.json({
      user: { email: user.email },
      wallet: balance,
      activity: activity.results ?? [],
      models: catalog.results ?? [],
      min_topup_cents: 2000,
      currency: 'USD',
      checkout_enabled: false,
      message: 'Las recargas se habilitarán tras configurar el proveedor de pagos y verificar los webhooks.'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
