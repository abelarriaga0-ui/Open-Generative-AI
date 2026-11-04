// Live, read-only Muapi model catalog and exact per-request pricing.
// This module NEVER submits a generation or uses a client-supplied provider URL.
import { isAllowedMuapiEndpoint } from './muapi-endpoint.js';

const API = 'https://api.muapi.ai';
const BAD_KEYS = /(?:api[_-]?key|token|secret|authorization|webhook|callback|payment|wallet|account[_-]?id)/i;
const MODEL_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MEDIA_KEY = /(?:image|video|audio|media|reference|file|source).*?(?:url|urls|list)|^(?:image_url|video_url|audio_url|images_list|videos_list|start_image|end_image|first_frame|last_frame)$/i;
const SAFE_ORIGIN = /^https:\/\//;

async function fetchJson(url, options = {}) {
  // Muapi publishes model lookup and cost estimates as PUBLIC endpoints.
  // A generation API key must never be sent to these requests: it only
  // belongs in the final, explicitly confirmed paid generation call.
  const headers={Accept:'application/json',...(options.headers||{})};
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{
        ...options, headers, cache:'no-store', redirect:'follow',
        signal:AbortSignal.timeout(18000)
      });
      if(response.status===404)throw new Error('muapi_model_not_found');
      if(response.status===400||response.status===422){
        // Muapi can return COST_CALC_FAILED for a valid image model even when
        // its estimator assumes video_url. Never call this a catalog outage.
        let detail=null;
        try{detail=await response.json();}catch{}
        if(detail?.error?.code==='COST_CALC_FAILED')throw new Error('muapi_pricing_contract_mismatch');
        throw new Error('provider_price_inputs_invalid');
      }
      if(response.status===429)throw new Error('muapi_rate_limited');
      if(!response.ok)throw new Error('muapi_catalog_unavailable');
      let data;
      try{data=await response.json()}catch{throw new Error('muapi_catalog_invalid')}
      if(!data||typeof data!=='object'||Array.isArray(data))
        throw new Error('muapi_catalog_invalid');
      return data;
    }catch(error){
      lastError=error;
      if(!['muapi_catalog_unavailable','muapi_rate_limited','TimeoutError','TypeError'].includes(error?.message)&&
        !['TimeoutError','TypeError'].includes(error?.name))break;
      if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  const code=lastError?.message;
  if(['muapi_model_not_found','provider_price_inputs_invalid','muapi_pricing_contract_mismatch',
      'muapi_rate_limited','muapi_catalog_invalid'].includes(code))throw lastError;
  throw new Error('muapi_catalog_unavailable');
}
function extractCost(value) {
  const v = typeof value === 'number' ? value :
    value && typeof value === 'object' ? (value.amount_usd ?? value.amount ?? value.usd) : undefined;
  return Number(v);
}
function videoModel(m) {
  const category = String(m.category || '') + ' ' + String(m.group_of || '');
  return /video/i.test(category);
}
// Exact, currently documented Muapi POST routes. Catalog records sometimes
// contain a stale legacy endpoint slug while estimation still works: never
// reserve wallet funds for that stale route. These are ROUTES, not prices.
const PUBLISHED_VIDEO_POST_ROUTES = Object.freeze({
  'seedance-2.5-intl-omni-reference':'seedance-2.5-intl-omni-reference',
  'seedance-2.5-omni-reference':'seedance-2.5-omni-reference',
  'seedance-2.5-intl-image-to-video':'seedance-2.5-intl-image-to-video',
  'seedance-2.5-intl-text-to-video':'seedance-2.5-intl-text-to-video',
});
function endpointOf(m, modelId) {
  // The 2.5 routes above are verified against Muapi's published POST API.
  // Never silently change model, provider or price during the operation.
  const official=PUBLISHED_VIDEO_POST_ROUTES[modelId];
  if(official)return official;
  // For all other models prefer the catalog's canonical endpoint_url when
  // available; keep Seedance 2.0's documented legacy slug as a special case.
  const entries=modelId==='seedance-2-omni-reference'
    ?[m.endpoint,m.endpoint_url]:[m.endpoint_url,m.endpoint];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    let path=entry;
    if (path.startsWith('https://')) {
      try {
        const u=new URL(path);
        if(u.origin!==API || u.search || u.hash)continue;
        path=u.pathname;
      }catch{continue;}
    }
    const slug=path.startsWith('/api/v1/') ? path.slice('/api/v1/'.length) : path;
    if(isAllowedMuapiEndpoint(slug))return slug;
  }
  return null;
}
export async function getLiveVideoModel(modelId, providerKey = '') {
  if (typeof modelId !== 'string' || !MODEL_ID.test(modelId) || modelId.length > 100)
    throw new Error('unsupported_model');
  // Avoid a dependency on the huge /models catalog for every generation.
  // Muapi officially supports both the single-model route and the list.
  let entry = null;
  let lastError;
  try {
    const data = await fetchJson(API + '/api/v1/models/' + encodeURIComponent(modelId));
    const candidate = data.model && typeof data.model === 'object' ? data.model : data;
    if (candidate.name === modelId || candidate.id === modelId) entry = candidate;
  } catch (error) { lastError = error; }
  if (!entry) {
    try {
      const data = await fetchJson(API + '/api/v1/models');
      if (!Array.isArray(data.models)) throw new Error('muapi_catalog_invalid');
      entry = data.models.find(m => m && (m.name === modelId || m.id === modelId));
      lastError = null;
    } catch (error) {
      // Fail safely: no amount is invented and no Muapi generation is sent.
      throw new Error(error.message === 'muapi_model_not_found' ?
        'muapi_catalog_unavailable' : (lastError?.message === 'muapi_catalog_invalid' ? 'muapi_catalog_invalid' : error.message));
    }
  }
  if (!entry || !videoModel(entry) || entry.is_enabled === false || entry.is_coming_soon === true)
    throw new Error('unsupported_model');
  const endpoint = endpointOf(entry,modelId);
  if (!endpoint) throw new Error('unsupported_model_endpoint');
  return { entry, endpoint };
}
function inspectInputs(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object' ||
      Object.keys(input).length > 32 || JSON.stringify(input).length > 120000)
    throw new Error('invalid_generation_request');
  function walk(obj, parent = '', depth = 0) {
    if (depth > 4) throw new Error('invalid_generation_request');
    if (typeof obj === 'string') {
      if (obj.length > 20000) throw new Error('invalid_generation_request');
      if (MEDIA_KEY.test(parent) && !SAFE_ORIGIN.test(obj))
        throw new Error('invalid_media_reference');
      return;
    }
    if (typeof obj === 'number') {
      if (!Number.isFinite(obj) || Math.abs(obj) > 1000000) throw new Error('invalid_generation_request');
      return;
    }
    if (typeof obj === 'boolean' || obj === null) return;
    if (Array.isArray(obj)) {
      if (obj.length > 12) throw new Error('invalid_generation_request');
      for (const item of obj) walk(item, parent, depth + 1);
      return;
    }
    if (obj && typeof obj === 'object') {
      for (const [k,v] of Object.entries(obj)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,65}$/.test(k) || BAD_KEYS.test(k))
          throw new Error('invalid_generation_request');
        walk(v, k, depth + 1);
      }
      return;
    }
    throw new Error('invalid_generation_request');
  }
  walk(input);
}
// Some editor reference workflows still emit legacy field aliases. These
// specific documented video endpoints use image_urls, never images_list or
// image_url. Normalize before pricing AND before paid generation so there is
// no hidden re-interpretation between the two stages.
const GEMINI_IMAGE_REFERENCE_ENDPOINTS=new Set([
  'gemini-omni-image-to-video',
  'gemini-omni-flash-1-1-text-to-video',
  'gemini-omni-flash-1-1-reference-to-video',
]);
export function normalizeLiveVideoInput(modelId,input){
  if(!GEMINI_IMAGE_REFERENCE_ENDPOINTS.has(modelId))return input;
  if(!input || typeof input!=='object'||Array.isArray(input))
    throw new Error('invalid_generation_request');
  const normalized={...input};
  const aliases=['image_urls','images_list','image_url'];
  const present=aliases.filter(key=>Object.hasOwn(normalized,key)&&normalized[key]!=null);
  // Never merge conflicting references or silently substitute start frames.
  if(present.length>1)throw new Error('model_reference_fields_conflict');
  const key=present[0];
  if(key){
    const images=key==='image_url'?[normalized.image_url]:normalized[key];
    if(!Array.isArray(images)||images.length<1||images.length>7||
        images.some(url=>typeof url!=='string'||!/^https:\/\//.test(url)))
      throw new Error('model_reference_images_invalid');
    delete normalized.images_list;
    delete normalized.image_url;
    normalized.image_urls=images;
  }
  if(modelId==='gemini-omni-image-to-video'&&!normalized.image_urls?.length)
    throw new Error('model_reference_images_required');
  const allowed=modelId==='gemini-omni-flash-1-1-reference-to-video'
    ? ['prompt','image_urls','reference_video_urls','duration','resolution','aspect_ratio','seed']
    : modelId==='gemini-omni-image-to-video'
      ? ['prompt','image_urls','duration','resolution','aspect_ratio','audio_ids','seed','character_ids']
      : ['prompt','image_urls','video_url','trim_start','trim_end','audio_ids','character_ids','seed','duration','resolution','aspect_ratio'];
  if(Object.keys(normalized).some(k=>!allowed.includes(k)))
    throw new Error('model_input_fields_unsupported');
  if(typeof normalized.prompt!=='string'||!normalized.prompt.trim())
    throw new Error('model_prompt_required');
  return normalized;
}
export async function quoteLiveVideo(modelId, input, providerKey = '') {
  input=normalizeLiveVideoInput(modelId,input);
  inspectInputs(input);
  const {entry, endpoint} = await getLiveVideoModel(modelId, providerKey);
  let providerUsd;
  if (entry.dynamic_pricing === true) {
    const path = entry.estimate_endpoint || '/api/v1/models/' + encodeURIComponent(entry.name || modelId) + '/estimate-cost';
    if (!/^\/api\/v1\/models\/[a-z0-9._-]+\/estimate-cost$/.test(path))
      throw new Error('unsupported_price_estimator');
    const estimate = await fetchJson(API + path, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(input)
    });
    if (estimate.currency && estimate.currency !== 'USD') throw new Error('unsupported_currency');
    providerUsd = extractCost(estimate.cost);
  } else if (entry.dynamic_pricing === false) {
    providerUsd = extractCost(entry.cost);
  } else {
    // If the provider has not declared whether pricing is dynamic,
    // never guess from a static headline price.
    throw new Error('model_pricing_unavailable');
  }
  if (entry.cost_currency && entry.cost_currency !== 'USD') throw new Error('unsupported_currency');
  if (!Number.isFinite(providerUsd) || providerUsd <= 0 || providerUsd > 1000)
    throw new Error('model_pricing_unavailable');
  return {model_id:modelId, endpoint, provider_cost_cents:Math.ceil(providerUsd * 100 - 1e-8)};
}
export function validateRelayMedia(input, host, userId) {
  // A first-party uploaded media path must be owned by the current signed-in account.
  // Other remote references are rejected; the API cannot proxy arbitrary hosts.
  const mediaPaths = [];
  function walk(value, field='') {
    if (typeof value === 'string' && (MEDIA_KEY.test(field) || /^(https?:)?\/\//i.test(value))) {
      if (/^https?:\/\//i.test(value)) mediaPaths.push(value);
    } else if (Array.isArray(value)) value.forEach(v => walk(v,field));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v]) => walk(v,k));
  }
  walk(input);
  if (mediaPaths.length > 12) throw new Error('invalid_media_reference');
  for (const path of mediaPaths) {
    const url = new URL(path);
    if (url.origin !== host || !/^\/api\/realizo\/media\/[0-9a-f-]{36}$/i.test(url.pathname) ||
        !url.searchParams.has('sig') || !url.searchParams.has('expires'))
      throw new Error('invalid_media_reference');
  }
  return mediaPaths;
}
export async function ensureOwnedMedia(env, user, input) {
  const {isOwnedSignedProductImage} = await import('./muapi-pilot.js');
  const paths = validateRelayMedia(input, env.REALIZO_AUTH_ORIGIN, user.id);
  for (const path of paths) {
    if (!await isOwnedSignedProductImage(env,user,path)) throw new Error('invalid_media_reference');
  }
}
export function userFacingQuoteError(err) {
  const code = String(err?.message || '');
  if (['unsupported_model','unsupported_model_endpoint','unsupported_price_estimator',
       'model_pricing_unavailable','unsupported_currency','invalid_media_reference',
       'invalid_generation_request','muapi_catalog_unavailable','muapi_catalog_invalid',
       'model_requires_video_reference','provider_price_inputs_invalid',
       'model_reference_fields_conflict','model_reference_images_invalid',
       'model_reference_images_required','model_input_fields_unsupported',
       'model_prompt_required',
       'muapi_pricing_contract_mismatch','muapi_rate_limited'].includes(code)) return code;
  return 'quote_unavailable';
}
