// Production requires live billing and explicit provider generation activation.
// A separately metered, single-user Sandbox pilot may spend real Muapi credits
// only after the operator installs the global key and an allowlisted account.
export function isMuapiGenerationEnabled(env,user=null){
  const production=env?.REALIZO_ENV!=='sandbox' && env?.PAYPAL_MODE==='live' &&
    env?.MUAPI_GENERATION_ENABLED==='true';
  if(production)return true;
  // Emergency loss containment. Sandbox funds are not real merchant receipts.
  // Never send expensive provider requests while sandbox billing is selected.
  return false;
}

// Imágenes que venden: factura únicamente saldo ya existente en D1.
// PayPal es un medio opcional de recarga y NO condiciona las generaciones de imágenes.
// El trigger de wallet reserva fondos reales y bloquea saldos insuficientes.
export function isConversionImageGenerationEnabled(env) {
  return env?.REALIZO_ENV === 'production' &&
    env?.REALIZO_TEMPLATE_IMAGES_ENABLED === 'true' &&
    Boolean(env?.WALLETS_DB && env?.MUAPI_API_KEY);
}
