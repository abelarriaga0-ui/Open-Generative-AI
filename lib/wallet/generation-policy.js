// Production requires live billing and explicit provider generation activation.
// A separately metered, single-user Sandbox pilot may spend real Muapi credits
// only after the operator installs the global key and an allowlisted account.
export function isMuapiGenerationEnabled(env,user=null){
  const production=env?.REALIZO_ENV!=='sandbox' && env?.PAYPAL_MODE==='live' &&
    env?.MUAPI_GENERATION_ENABLED==='true';
  if(production)return true;
  // EMERGENCY LOSS CONTAINMENT: never call the paid video provider from a
  // public test-payments environment, including the formerly allowlisted pilot.
  // All paid generations require a separate verified live-billing release.
  return Boolean(false && env?.REALIZO_ENV==='sandbox' && env?.PAYPAL_MODE==='sandbox' &&
    env?.REALIZO_AUTH_PROVIDER==='native' &&
    env?.MUAPI_GENERATION_ENABLED==='true' &&
    env?.REALIZO_MUAPI_PILOT==='true' &&
    user?.id && env?.REALIZO_MUAPI_PILOT_ACCOUNT_ID &&
    user.id===env.REALIZO_MUAPI_PILOT_ACCOUNT_ID);
}
