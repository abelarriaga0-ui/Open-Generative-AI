// Live, read-only Muapi model catalog and exact per-request pricing.
// This module NEVER submits a generation or uses a client-supplied provider URL.
import { isAllowedMuapiEndpoint } from './muapi-endpoint.js';

const API = 'https://api.muapi.ai';
const BAD_KEYS = /(?:api[_-]?key|token|secret|authorization|webhook|callback|payment|wallet|account[_-]?id)/i;
const MODEL_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MEDIA_KEY = /(?:image|video|audio|media|reference|file|source).*?(?:url|urls|list)|^(?:image_url|video_url|audio_url|images_list|videos_list|start_image|end_image|first_frame|last_frame)$/i;
const SAFE_ORIGIN = /^https:\/\//;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error('muapi_catalog_unavailable');
  const data = await response.json();
  if (!data || typeof data !== 'object') throw new Error('muapi_catalog_invalid');
  return data;
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
function endpointOf(m) {
  const path = m.endpoint_url || m.endpoint;
  if (typeof path !== 'string' || !path.startsWith('/api/v1/')) return null;
  const slug = path.slice('/api/v1/'.length);
  return isAllowedMuapiEndpoint(slug) ? slug : null;
}
export async function getLiveVideoModel(modelId) {
  if (typeof modelId !== 'string' || !MODEL_ID.test(modelId) || modelId.length > 100)
    throw new Error('unsupported_model');
  const data = await fetchJson(API + '/api/v1/models');
  const models = Array.isArray(data.models) ? data.models : [];
  const entry = models.find(m => m && (m.name === modelId || m.id === modelId));
  if (!entry || !videoModel(entry) || entry.is_enabled === false || entry.is_coming_soon === true)
    throw new Error('unsupported_model');
  const endpoint = endpointOf(entry);
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
export async function quoteLiveVideo(modelId, input) {
  inspectInputs(input);
  const {entry, endpoint} = await getLiveVideoModel(modelId);
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
       'invalid_generation_request','muapi_catalog_unavailable','muapi_catalog_invalid'].includes(code)) return code;
  return 'quote_unavailable';
}
