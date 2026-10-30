// A funded Sandbox wallet must never spend the platform's real Muapi balance.
// Enabling paid generation needs a separate, explicitly authorized environment.
export function isMuapiGenerationEnabled(env) {
  return env?.REALIZO_ENV !== 'sandbox' && env?.PAYPAL_MODE === 'live' &&
    env?.MUAPI_GENERATION_ENABLED === 'true';
}
