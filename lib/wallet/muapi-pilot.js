import {isMuapiGenerationEnabled} from './generation-policy.js';
import {mediaSignature,canReadSignedMedia} from '../realizo-creative/media.js';
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

export async function isOwnedSignedProductImage(env,user,url) {
  if (!user?.id || typeof url!=='string' || url.length>1200) return false;
  try {
    const parsed=new URL(url);
    if(parsed.origin!==env.REALIZO_AUTH_ORIGIN || !/^\/api\/realizo\/media\/[0-9a-f-]{36}$/i.test(parsed.pathname))return false;
    if([...parsed.searchParams.keys()].some(k=>!['expires','sig'].includes(k)) ||
      parsed.searchParams.getAll('expires').length!==1 ||
      parsed.searchParams.getAll('sig').length!==1)return false;
    const id=parsed.pathname.split('/').at(-1);
    const expiry=Number(parsed.searchParams.get('expires'));
    const signature=parsed.searchParams.get('sig')||'';
    if(!canReadSignedMedia(expiry)||!/^[-0-9a-f]{64}$/i.test(signature))return false;
    const expected=await mediaSignature(env.REALIZO_AUTH_PEPPER,id,expiry);
    let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
    if(diff!==0)return false;
    const asset=await env.WALLETS_DB.prepare(
      'SELECT id FROM realizo_media_assets WHERE id=? AND user_id=? AND expires_at>=? AND deleted_at IS NULL'
    ).bind(id,user.id,expiry).first();
    return Boolean(asset?.id);
  }catch{return false}
}
