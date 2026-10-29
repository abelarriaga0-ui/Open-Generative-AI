import {isMuapiGenerationEnabled} from './generation-policy.js';
export const PILOT_MODEL_ID='wan2.2-image-to-video';
export const PILOT_ENDPOINT='wan2.2-image-to-video';
export const PILOT_PRICE_CENTS=35;
export const PILOT_EXPECTED_PROVIDER_CENTS=30;
export const PILOT_OPTIONS=Object.freeze({duration:5,resolution:'480p',quality:'medium'});
export const PILOT_INPUT_KEYS=Object.freeze(['prompt','image_url','aspect_ratio']);
export function isPilotAccount(env,user){
  return Boolean(user?.id && env?.REALIZO_ENV==='sandbox' &&
    env?.REALIZO_MUAPI_PILOT==='true' && env?.MUAPI_GENERATION_ENABLED==='true' &&
    env?.PAYPAL_MODE==='sandbox' && env?.REALIZO_AUTH_PROVIDER==='native' &&
    env?.REALIZO_MUAPI_PILOT_ACCOUNT_ID &&
    user.id===env.REALIZO_MUAPI_PILOT_ACCOUNT_ID);
}
export async function getPilotSlotsRemaining(env,user) {
  if(!isPilotAccount(env,user) || !isMuapiGenerationEnabled(env,user))return 0;
  const occupied=await env.WALLETS_DB.prepare('SELECT slot FROM realizo_muapi_pilot_uses WHERE slot=1').first();
  return occupied?0:1;
}
export async function claimPilotSlot(env,user,jobId) {
  if(!isPilotAccount(env,user))return false;
  const result=await env.WALLETS_DB.prepare(
    'INSERT OR IGNORE INTO realizo_muapi_pilot_uses(slot,job_id,user_id) VALUES(1,?,?)'
  ).bind(jobId,user.id).run();
  return result.meta?.changes===1;
}
export function isPilotPriceConfigValid(model){
  if(!model)return false;
  try{
    const fixed=JSON.parse(model.fixed_options_json);
    const allowed=JSON.parse(model.allowed_input_keys_json);
    return model.model_id===PILOT_MODEL_ID && model.muapi_endpoint===PILOT_ENDPOINT &&
      model.customer_price_cents===PILOT_PRICE_CENTS &&
      allowed.length===PILOT_INPUT_KEYS.length &&
      PILOT_INPUT_KEYS.every(x=>allowed.includes(x)) &&
      Object.keys(fixed).length===3 &&
      Object.entries(PILOT_OPTIONS).every(([k,v])=>fixed[k]===v);
  }catch{return false}
}
