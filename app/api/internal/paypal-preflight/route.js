import { getWalletEnvironment } from '@/lib/wallet/server';

export const dynamic = 'force-dynamic';

function hasValidOperatorToken(request, secret) {
  const provided = request.headers.get('x-realizo-operator-token') || '';
  if (!secret || secret.length < 48 || provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return mismatch === 0;
}

export async function GET(request) {
  try {
    const env = await getWalletEnvironment();
    if (!hasValidOperatorToken(request, env.REALIZO_OPERATOR_PREFLIGHT_TOKEN)) {
      return Response.json({error: 'not_found'}, {status: 404, headers:{'Cache-Control':'no-store'}});
    }
    if (env.REALIZO_ENV !== 'production' || env.PAYPAL_MODE !== 'live' ||
      !env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_WEBHOOK_ID) {
      return Response.json({ready:false,reason:'configuration'}, {status:503,headers:{'Cache-Control':'no-store'}});
    }
    const ctrl = AbortSignal.timeout(15000);
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token',{
      method:'POST',
      headers:{
        'Authorization':'Basic '+btoa(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET),
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body:'grant_type=client_credentials',signal:ctrl
    });
    if (!tokenResponse.ok) return Response.json({ready:false,reason:'paypal_oauth'}, {status:503,headers:{'Cache-Control':'no-store'}});
    const access=(await tokenResponse.json()).access_token;
    if (!access) return Response.json({ready:false,reason:'paypal_oauth'}, {status:503,headers:{'Cache-Control':'no-store'}});
    const hookResponse=await fetch('https://api-m.paypal.com/v1/notifications/webhooks/'+encodeURIComponent(env.PAYPAL_WEBHOOK_ID),{
      headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)
    });
    if (!hookResponse.ok) return Response.json({ready:false,reason:'paypal_webhook'}, {status:503,headers:{'Cache-Control':'no-store'}});
    const hook=await hookResponse.json();
    const expected=String(env.REALIZO_AUTH_ORIGIN||'').replace(/\/$/,'')+'/api/wallet/paypal/webhook';
    if (hook.id!==env.PAYPAL_WEBHOOK_ID || hook.url!==expected ||
      !Array.isArray(hook.event_types) ||
      !hook.event_types.some(event=>['PAYMENT.CAPTURE.COMPLETED','*'].includes(event.name))) {
      return Response.json({ready:false,reason:'paypal_webhook_mismatch'}, {status:503,headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({ready:true,mode:'live',verified_webhook:true},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ready:false,reason:'unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
