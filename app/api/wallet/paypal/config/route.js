import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { assertPaypalConfigured, paypalBaseUrl, paypalRequest } from '@/lib/wallet/paypal';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    assertPaypalConfigured(env);
    paypalBaseUrl(env); // Live requires production Worker and explicit merchant enablement.
    if (!env.PAYPAL_WEBHOOK_ID) throw new Error('paypal_webhook_not_configured');
    if(env.PAYPAL_MODE==='live'){
      const verification=await paypalRequest(env,'/v1/notifications/webhooks/'+encodeURIComponent(env.PAYPAL_WEBHOOK_ID));
      const hook=verification.data;
      const configuredOrigin=String(env.REALIZO_AUTH_ORIGIN||'');
      const correctUrl=(configuredOrigin.endsWith('/')?configuredOrigin.slice(0,-1):configuredOrigin)+'/api/wallet/paypal/webhook';
      if(!verification.ok||hook?.id!==env.PAYPAL_WEBHOOK_ID||hook?.url!==correctUrl||
         !Array.isArray(hook?.event_types)||!hook.event_types.some(e=>e.name==='PAYMENT.CAPTURE.COMPLETED'||e.name==='*'))
        throw new Error('paypal_live_webhook_not_verified');
    }
    return Response.json({
      client_id: env.PAYPAL_CLIENT_ID, currency: 'USD',
      mode: env.PAYPAL_MODE || 'sandbox'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code=String(error?.message||'');
    if(code==='paypal_auth_unavailable'||code==='paypal_auth_invalid'){
      return Response.json({
        error:'paypal_live_credentials_rejected',
        message:'PayPal Live rechazó las credenciales. Vuelve a guardar el Client ID y la Secret Key de la misma aplicación Realizo en Cloudflare.'
      },{status:503,headers:{'Cache-Control':'no-store'}});
    }
    if(code==='paypal_live_webhook_not_verified'){
      return Response.json({
        error:'paypal_live_webhook_not_verified',
        message:'Las credenciales funcionan, pero el Webhook ID de PayPal Live no coincide con la dirección de Realizo o le falta el evento PAYMENT.CAPTURE.COMPLETED.'
      },{status:503,headers:{'Cache-Control':'no-store'}});
    }
    return jsonError(error);
  }
}
