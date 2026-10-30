import {isPilotAccount} from './muapi-pilot.js';

// The owner is testing with a normal native Realizo account. This gate
// recognizes only the same account that was credited USD 7.75 from Muapi.
// It cannot be enabled for unrelated customers by setting a UI flag.
export async function isOwnerMultiModelSandbox(env,user) {
  if (env?.REALIZO_ENV !== 'sandbox' ||
      env?.PAYPAL_MODE !== 'sandbox' ||
      env?.REALIZO_MULTI_MODEL_SANDBOX !== 'true' ||
      !env?.WALLETS_DB || !isPilotAccount(env,user)) return false;
  const result = await env.WALLETS_DB.prepare(
    'SELECT user_id FROM realizo_prepaid_muapi_imports WHERE slot=1 AND user_id=? AND amount_cents=775'
  ).bind(user.id).first();
  return result?.user_id === user.id;
}
